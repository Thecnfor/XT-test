import os
import uuid
import html
import re
import threading
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
import time
import hashlib
import ipaddress
from collections import defaultdict, deque
from functools import wraps
import asyncio

# 配置日志
logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

from schemas.user import User, RegisterRequest, LoginRequest
from services.database_service import add_user, verify_user, get_user
from services.session_service import SessionService
from services.password_service import get_password_service, init_password_service
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, SESSION_EXPIRE_MINUTES, SESSION_FILE, ENCRYPTION_KEY, ADMIN_CONFIG_FILE

# 读取管理员配置
def load_admin_config():
    try:
        with open(ADMIN_CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"读取管理员配置失败: {e}")
        return {'admin_users': []}

# 检查用户是否为管理员
def is_admin_user(username: str) -> bool:
    admin_config = load_admin_config()
    return username in admin_config.get('admin_users', [])
# 初始化密码服务
init_password_service(ENCRYPTION_KEY)
password_service = get_password_service()

# 初始化会话服务
session_service = SessionService(SESSION_FILE, SESSION_EXPIRE_MINUTES)

# 解密密码（使用密码服务）
def decrypt_password(encrypted_password: str) -> str:
    """解密前端加密的密码

    Args:
        encrypted_password: 前端加密后的密码字符串

    Returns:
        解密后的原始密码
    """
    return password_service.decrypt_password(encrypted_password)

# 速率限制器类
class RateLimiter:
    """基于滑动窗口的速率限制器"""
    
    def __init__(self):
        self.requests = defaultdict(lambda: deque())
        self.blocked_ips = defaultdict(lambda: {'until': None, 'attempts': 0})
        self.cleanup_interval = 300  # 5分钟清理一次
        self.last_cleanup = time.time()
    
    def _cleanup_old_requests(self):
        """清理过期的请求记录"""
        current_time = time.time()
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        # 清理过期的请求记录
        for key in list(self.requests.keys()):
            requests = self.requests[key]
            while requests and current_time - requests[0] > 3600:  # 1小时
                requests.popleft()
            if not requests:
                del self.requests[key]
        
        # 清理过期的IP封禁
        for ip in list(self.blocked_ips.keys()):
            if (self.blocked_ips[ip]['until'] and 
                current_time > self.blocked_ips[ip]['until']):
                del self.blocked_ips[ip]
        
        self.last_cleanup = current_time
    
    def is_rate_limited(self, identifier: str, max_requests: int, window_seconds: int) -> bool:
        """检查是否超过速率限制"""
        self._cleanup_old_requests()
        
        current_time = time.time()
        requests = self.requests[identifier]
        
        # 移除窗口外的请求
        while requests and current_time - requests[0] > window_seconds:
            requests.popleft()
        
        # 检查是否超过限制
        if len(requests) >= max_requests:
            return True
        
        # 记录当前请求
        requests.append(current_time)
        return False
    
    def is_ip_blocked(self, ip: str) -> bool:
        """检查IP是否被封禁"""
        if ip in self.blocked_ips:
            block_info = self.blocked_ips[ip]
            if block_info['until'] and time.time() < block_info['until']:
                return True
            elif block_info['until'] and time.time() >= block_info['until']:
                del self.blocked_ips[ip]
        return False
    
    def block_ip(self, ip: str, duration_seconds: int = 3600):
        """封禁IP"""
        self.blocked_ips[ip] = {
            'until': time.time() + duration_seconds,
            'attempts': self.blocked_ips[ip]['attempts'] + 1
        }
        logger.warning(f"IP {ip} 已被封禁 {duration_seconds} 秒")
    
    def record_failed_attempt(self, ip: str, max_attempts: int = 5, block_duration: int = 3600):
        """记录失败尝试，超过阈值则封禁IP"""
        if ip not in self.blocked_ips:
            self.blocked_ips[ip] = {'until': None, 'attempts': 0}
        
        self.blocked_ips[ip]['attempts'] += 1
        
        if self.blocked_ips[ip]['attempts'] >= max_attempts:
            self.block_ip(ip, block_duration)

# 全局速率限制器实例
rate_limiter = RateLimiter()

# 输入验证器类
class InputValidator:
    """增强的输入验证器"""
    
    # 用户名验证规则
    USERNAME_MIN_LENGTH = 3
    USERNAME_MAX_LENGTH = 32
    USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_\-\.]+$')
    
    # 密码验证规则
    PASSWORD_MIN_LENGTH = 8
    PASSWORD_MAX_LENGTH = 128
    
    # 危险模式
    DANGEROUS_PATTERNS = [
        r'<script.*?>.*?</script>',
        r'on[a-zA-Z]+\s*=',  # 事件处理器
        r'javascript:',
        r'data:',
        r'vbscript:',
        r'<iframe.*?>.*?</iframe>',
        r'<object.*?>.*?</object>',
        r'<embed.*?>.*?</embed>',
        r'<link.*?>',
        r'<meta.*?>',
        r'<style.*?>.*?</style>',
        r'expression\s*\(',
        r'url\s*\(',
        r'@import',
        r'\\x[0-9a-fA-F]{2}',  # 十六进制编码
        r'\\u[0-9a-fA-F]{4}',  # Unicode编码
    ]
    
    # SQL注入模式
    SQL_INJECTION_PATTERNS = [
        r'(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)',
        r'(--|#|/\*|\*/)',
        r'(\b(OR|AND)\b.*\b(=|LIKE)\b)',
        r'(\b(CHAR|ASCII|SUBSTRING|LENGTH)\b\s*\()',
        r'(\b(WAITFOR|DELAY)\b)',
        r'(\b(CAST|CONVERT)\b\s*\()',
    ]
    
    @staticmethod
    def validate_username(username: str) -> Dict[str, Any]:
        """验证用户名"""
        if not username:
            return {'valid': False, 'error': '用户名不能为空'}
        
        if len(username) < InputValidator.USERNAME_MIN_LENGTH:
            return {'valid': False, 'error': f'用户名长度不能少于{InputValidator.USERNAME_MIN_LENGTH}个字符'}
        
        if len(username) > InputValidator.USERNAME_MAX_LENGTH:
            return {'valid': False, 'error': f'用户名长度不能超过{InputValidator.USERNAME_MAX_LENGTH}个字符'}
        
        if not InputValidator.USERNAME_PATTERN.match(username):
            return {'valid': False, 'error': '用户名只能包含字母、数字、下划线、连字符和点'}
        
        # 检查是否包含危险字符
        if not InputValidator.is_safe_input(username):
            return {'valid': False, 'error': '用户名包含不安全字符'}
        
        return {'valid': True}
    
    @staticmethod
    def validate_password_format(password: str) -> Dict[str, Any]:
        """验证密码格式（不包括强度检查）"""
        if not password:
            return {'valid': False, 'error': '密码不能为空'}
        
        if len(password) < InputValidator.PASSWORD_MIN_LENGTH:
            return {'valid': False, 'error': f'密码长度不能少于{InputValidator.PASSWORD_MIN_LENGTH}个字符'}
        
        if len(password) > InputValidator.PASSWORD_MAX_LENGTH:
            return {'valid': False, 'error': f'密码长度不能超过{InputValidator.PASSWORD_MAX_LENGTH}个字符'}
        
        return {'valid': True}
    
    @staticmethod
    def is_safe_input(input_str: str) -> bool:
        """验证输入是否安全，不包含危险字符或脚本"""
        if not input_str:
            return False
        
        # 检查危险模式
        for pattern in InputValidator.DANGEROUS_PATTERNS:
            if re.search(pattern, input_str, re.IGNORECASE):
                logger.warning(f"检测到危险输入模式: {pattern}")
                return False
        
        # 检查SQL注入模式
        for pattern in InputValidator.SQL_INJECTION_PATTERNS:
            if re.search(pattern, input_str, re.IGNORECASE):
                logger.warning(f"检测到SQL注入模式: {pattern}")
                return False
        
        return True
    
    @staticmethod
    def validate_session_id(session_id: str) -> Dict[str, Any]:
        """验证会话ID格式"""
        if not session_id:
            return {'valid': False, 'error': '会话ID不能为空'}
        
        # 会话ID应该是UUID格式
        try:
            uuid.UUID(session_id)
        except ValueError:
            return {'valid': False, 'error': '无效的会话ID格式'}
        
        return {'valid': True}
    
    @staticmethod
    def validate_ip_address(ip: str) -> bool:
        """验证IP地址格式"""
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False
    
    @staticmethod
    def sanitize_input(input_str: str) -> str:
        """清理输入字符串"""
        if not input_str:
            return ""
        
        # HTML转义
        sanitized = html.escape(input_str)
        
        # 移除控制字符
        sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', sanitized)
        
        return sanitized.strip()

# 验证输入是否安全（保持向后兼容）
def is_safe_input(input_str: str) -> bool:
    """验证输入是否安全，不包含危险字符或脚本"""
    return InputValidator.is_safe_input(input_str)


# 会话相关请求模型
class LogoutRequest(BaseModel):
    session_id: str

class ValidateSessionRequest(BaseModel):
    session_id: str

class ForceLogoutRequest(BaseModel):
    username: str

# 定期清理过期会话的线程函数
def session_cleanup_worker():
    """后台线程函数，定期清理过期会话"""
    from config import SESSION_CLEANUP_INTERVAL_MINUTES
    while True:
        session_service._cleanup_expired_sessions()
        time.sleep(SESSION_CLEANUP_INTERVAL_MINUTES * 60)  # 每{SESSION_CLEANUP_INTERVAL_MINUTES}分钟清理一次

# 启动会话清理线程
def start_session_cleanup_thread():
    cleanup_thread = threading.Thread(target=session_cleanup_worker, daemon=True)
    cleanup_thread.start()
    logger.info("会话清理线程已启动")

# 启动会话清理线程
start_session_cleanup_thread()

# 已合并到上方导入

# 速率限制装饰器
def rate_limit(max_requests: int = 10, window_seconds: int = 60, per_ip: bool = True, per_user: bool = False):
    """速率限制装饰器
    
    Args:
        max_requests: 最大请求数
        window_seconds: 时间窗口（秒）
        per_ip: 是否按IP限制
        per_user: 是否按用户限制
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 获取请求对象
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # 从kwargs中查找request
                for key, value in kwargs.items():
                    if isinstance(value, Request):
                        request = value
                        break
            
            if request:
                client_ip = get_client_ip(request)
                
                # 检查IP是否被封禁
                if rate_limiter.is_ip_blocked(client_ip):
                    logger.warning(f"被封禁的IP尝试访问: {client_ip}")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="IP已被临时封禁，请稍后再试"
                    )
                
                # 按IP限制
                if per_ip:
                    identifier = f"ip:{client_ip}"
                    if rate_limiter.is_rate_limited(identifier, max_requests, window_seconds):
                        logger.warning(f"IP {client_ip} 触发速率限制")
                        raise HTTPException(
                            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail=f"请求过于频繁，请在{window_seconds}秒后重试"
                        )
                
                # 按用户限制（如果有用户信息）
                if per_user:
                    try:
                        current_user = await get_current_user(request)
                        if current_user:
                            identifier = f"user:{current_user.username}"
                            if rate_limiter.is_rate_limited(identifier, max_requests, window_seconds):
                                logger.warning(f"用户 {current_user.username} 触发速率限制")
                                raise HTTPException(
                                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                                    detail=f"请求过于频繁，请在{window_seconds}秒后重试"
                                )
                    except HTTPException:
                        # 如果无法获取用户信息，继续执行
                        pass
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# 获取客户端真实IP
def get_client_ip(request: Request) -> str:
    """获取客户端真实IP地址"""
    # 检查代理头
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # 取第一个IP（客户端真实IP）
        ip = forwarded_for.split(",")[0].strip()
        if InputValidator.validate_ip_address(ip):
            return ip
    
    # 检查其他代理头
    real_ip = request.headers.get("X-Real-IP")
    if real_ip and InputValidator.validate_ip_address(real_ip):
        return real_ip
    
    # 使用直连IP
    if request.client and request.client.host:
        return request.client.host
    
    return "unknown"

# 记录安全事件
def log_security_event(event_type: str, details: Dict[str, Any], request: Request = None):
    """记录安全相关事件"""
    event_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "details": details
    }
    
    if request:
        event_data.update({
            "client_ip": get_client_ip(request),
            "user_agent": request.headers.get("user-agent", "unknown"),
            "endpoint": str(request.url)
        })
    
    logger.warning(f"安全事件: {json.dumps(event_data, ensure_ascii=False)}")

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


def get_active_session_count() -> int:
    """获取当前活跃会话数量"""
    return session_service.get_active_session_count()

# 创建访问令牌
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# 获取当前用户
async def get_current_user(request: Request):
    # 从cookie中获取token
    token = request.cookies.get('token')
    if not token:
        # 如果cookie中没有token，尝试从请求头中获取
        token = request.headers.get('Authorization')
        if token and token.startswith('Bearer '):
            token = token[7:]
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await get_user(username)
    if user is None:
        raise credentials_exception
    return user

# 用户注册API
@router.post("/register", response_model=dict)
@rate_limit(max_requests=3, window_seconds=300, per_ip=True)  # 5分钟内最多3次注册尝试
async def register(user: RegisterRequest, request: Request):
    client_ip = get_client_ip(request)
    
    try:
        # 增强的用户名验证
        username_validation = InputValidator.validate_username(user.username)
        if not username_validation['valid']:
            log_security_event("invalid_username", {
                "username": user.username,
                "error": username_validation['error']
            }, request)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=username_validation['error']
            )
        
        # 清理和转义用户名
        username = InputValidator.sanitize_input(user.username)
        
        # 解密密码
        try:
            encrypted_password = InputValidator.sanitize_input(user.password)
            password = decrypt_password(encrypted_password)
        except Exception as e:
            log_security_event("password_decrypt_failed", {
                "username": username,
                "error": str(e)
            }, request)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码格式错误"
            )
        
        # 验证密码格式
        password_validation = InputValidator.validate_password_format(password)
        if not password_validation['valid']:
            log_security_event("invalid_password_format", {
                "username": username,
                "error": password_validation['error']
            }, request)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=password_validation['error']
            )
        
        # 验证密码强度
        try:
            strength_result = password_service.validate_password_strength(password)
            if not strength_result.get('valid', False):
                log_security_event("weak_password", {
                    "username": username,
                    "issues": strength_result.get('issues', [])
                }, request)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"密码强度不足: {', '.join(strength_result.get('issues', []))}"
                )
        except Exception as e:
            logger.error(f"密码强度验证失败: {e}")
            # 如果密码强度验证失败，继续注册但记录日志
            log_security_event("password_strength_check_failed", {
                "username": username,
                "error": str(e)
            }, request)
        
        # 尝试添加用户
        if await add_user(username, password):
            log_security_event("user_registered", {
                "username": username,
                "success": True
            }, request)
            logger.info(f"用户注册成功: {username}, IP: {client_ip}")
            return {"message": "注册成功", "username": username}
        else:
            log_security_event("registration_failed", {
                "username": username,
                "reason": "用户名已存在"
            }, request)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名已存在"
            )
    
    except HTTPException:
        # 记录失败尝试
        rate_limiter.record_failed_attempt(client_ip, max_attempts=10, block_duration=1800)  # 30分钟封禁
        raise
    except Exception as e:
        log_security_event("registration_error", {
            "username": getattr(user, 'username', 'unknown'),
            "error": str(e)
        }, request)
        logger.error(f"注册过程中发生错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="注册失败，请稍后重试"
        )

# 获取客户端信息
async def get_client_info(request: Request) -> Dict:
    """获取客户端信息，包括IP、浏览器指纹和设备信息"""
    # 获取IP地址
    client_ip = request.client.host if request.client else "unknown"
    
    # 获取用户代理
    user_agent = request.headers.get("user-agent", "unknown")
    
    # 简单的设备检测
    device_type = "unknown"
    if "mobile" in user_agent.lower():
        device_type = "mobile"
    elif "tablet" in user_agent.lower():
        device_type = "tablet"
    elif "desktop" in user_agent.lower() or "windows" in user_agent.lower() or "macintosh" in user_agent.lower():
        device_type = "desktop"
    
    # 浏览器检测
    browser = "unknown"
    if "chrome" in user_agent.lower():
        browser = "chrome"
    elif "firefox" in user_agent.lower():
        browser = "firefox"
    elif "safari" in user_agent.lower():
        browser = "safari"
    elif "edge" in user_agent.lower():
        browser = "edge"
    
    # 构建会话属性
    session_attributes = {
        "ip": client_ip,
        "user_agent": user_agent,
        "device_type": device_type,
        "browser": browser,
        "last_activity": datetime.utcnow()
    }
    
    return session_attributes

# 用户登录API - 获取令牌和会话ID
@router.post("/token", response_model=dict)
@rate_limit(max_requests=5, window_seconds=300, per_ip=True)  # 5分钟内最多5次登录尝试
async def login(login_request: LoginRequest, request: Request):
    client_ip = get_client_ip(request)
    
    try:
        # 增强的用户名验证
        username_validation = InputValidator.validate_username(login_request.username)
        if not username_validation['valid']:
            log_security_event("login_invalid_username", {
                "username": login_request.username,
                "error": username_validation['error']
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=900)  # 15分钟封禁
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名格式错误"
            )
        
        # 清理和转义用户名
        username = InputValidator.sanitize_input(login_request.username)
        
        # 解密密码
        try:
            encrypted_password = InputValidator.sanitize_input(login_request.password)
            password = decrypt_password(encrypted_password)
        except Exception as e:
            log_security_event("login_password_decrypt_failed", {
                "username": username,
                "error": str(e)
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=900)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码格式错误"
            )
        
        # 验证密码格式
        password_validation = InputValidator.validate_password_format(password)
        if not password_validation['valid']:
            log_security_event("login_invalid_password_format", {
                "username": username,
                "error": password_validation['error']
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=900)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码格式错误"
            )
        
        # 验证用户凭据
        if not await verify_user(username, password):
            log_security_event("login_failed", {
                "username": username,
                "reason": "用户名或密码错误"
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=900)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 创建访问令牌
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": username}, expires_delta=access_token_expires
        )
        
        # 获取客户端信息
        session_attributes = await get_client_info(request)
        
        # 记录登录时间
        session_attributes["login_time"] = datetime.utcnow()
        
        # 创建会话
        session_id = session_service.create_session(username, session_attributes)
        
        if not session_id:
            log_security_event("session_creation_failed", {
                "username": username,
                "reason": "已达到最大活跃会话数"
            }, request)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"已达到最大活跃会话数 {session_service.max_sessions_per_user}，且所有会话都处于活跃状态",
            )
        
        # 记录成功登录
        log_security_event("login_success", {
            "username": username,
            "session_id": session_id
        }, request)
        logger.info(f"用户 {username} 登录成功，会话ID: {session_id}, IP: {client_ip}")
        
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "session_id": session_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("login_error", {
            "username": getattr(login_request, 'username', 'unknown'),
            "error": str(e)
        }, request)
        logger.error(f"登录过程中发生错误: {e}")
        rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=900)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录失败，请稍后重试"
        )


# 用户登出API - 结束会话
@router.post("/logout", response_model=dict)
async def logout(logout_request: LogoutRequest):
    session_id = logout_request.session_id
    
    if session_service.end_session(session_id):
        return {"message": "登出成功", "session_id": session_id}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在或已过期"
        )

# 验证会话API（带劫持检测）
@router.post("/validate_session", response_model=dict)
@rate_limit(max_requests=30, window_seconds=60, per_ip=True)  # 1分钟内最多30次会话验证
async def validate_session(validate_request: ValidateSessionRequest, request: Request):
    client_ip = get_client_ip(request)
    
    try:
        # 验证会话ID格式
        session_validation = InputValidator.validate_session_id(validate_request.session_id)
        if not session_validation['valid']:
            log_security_event("session_validation_invalid_format", {
                "session_id": validate_request.session_id[:8] + "...",
                "error": session_validation['error']
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=10, block_duration=300)  # 5分钟封禁
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="会话ID格式无效"
            )
        
        # 清理会话ID
        session_id = InputValidator.sanitize_input(validate_request.session_id)
        
        # 获取客户端信息
        client_info = await get_client_info(request)
        
        # 验证会话并检测劫持
        result = session_service.validate_session(session_id, client_info)
        
        if result['valid']:
            # 更新会话的最后活动时间
            session_service.update_session_activity(session_id)
            
            response = {
                "valid": True,
                "username": result["username"],
                "expire_time": result["expire_time"].isoformat()
            }
            
            # 如果检测到会话劫持
            if result['hijacked']:
                response["hijacked"] = True
                response["message"] = "检测到异常登录，会话可能已被劫持"
                # 记录会话劫持事件
                log_security_event("session_hijack_detected", {
                    "session_id": session_id[:8] + "...",
                    "username": result["username"]
                }, request)
                # 在实际应用中，可能需要自动结束被劫持的会话
                # session_service.end_session(session_id, reason="hijacked")
            
            return response
        else:
            log_security_event("session_validation_invalid", {
                "session_id": session_id[:8] + "..."
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=10, block_duration=300)
            return {"valid": False, "hijacked": False}
    
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("session_validation_error", {
            "session_id": getattr(validate_request, 'session_id', 'unknown')[:8] + "...",
            "error": str(e)
        }, request)
        logger.error(f"会话验证过程中发生错误: {e}")
        rate_limiter.record_failed_attempt(client_ip, max_attempts=10, block_duration=300)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="会话验证失败，请稍后重试"
        )

# 刷新会话API
@router.post("/refresh_session", response_model=dict)
@rate_limit(max_requests=20, window_seconds=60, per_ip=True)  # 1分钟内最多20次会话刷新
async def refresh_session(validate_request: ValidateSessionRequest, request: Request):
    client_ip = get_client_ip(request)
    
    try:
        # 验证会话ID格式
        session_validation = InputValidator.validate_session_id(validate_request.session_id)
        if not session_validation['valid']:
            log_security_event("session_refresh_invalid_format", {
                "session_id": validate_request.session_id[:8] + "...",
                "error": session_validation['error']
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=10, block_duration=300)  # 5分钟封禁
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="会话ID格式无效"
            )
        
        # 清理会话ID
        session_id = InputValidator.sanitize_input(validate_request.session_id)
        
        # 获取客户端信息
        client_info = await get_client_info(request)
        
        # 刷新会话并检测劫持
        result = session_service.validate_session(session_id, client_info)
        if not result['valid']:
            log_security_event("session_refresh_invalid", {
                "session_id": session_id[:8] + "..."
            }, request)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=10, block_duration=300)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的会话ID"
            )
        
        # 更新会话的最后活动时间
        session_service.update_session_activity(session_id)
        
        response = {
            "success": True,
            "new_expire_time": result['expire_time'].isoformat()
        }
        
        # 如果检测到会话劫持
        if result['hijacked']:
            response["hijacked"] = True
            response["message"] = "检测到异常登录，会话可能已被劫持"
            # 记录会话劫持事件
            log_security_event("session_hijack_detected_refresh", {
                "session_id": session_id[:8] + "...",
                "username": result.get("username", "unknown")
            }, request)
            # 在实际应用中，可能需要自动结束被劫持的会话
            # session_service.end_session(session_id, reason="hijacked")
        
        # 记录成功的会话刷新（仅在调试模式下）
        # log_security_event("session_refresh_success", {
        #     "session_id": session_id[:8] + "...",
        #     "username": result.get("username", "unknown")
        # }, request)
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("session_refresh_error", {
            "session_id": getattr(validate_request, 'session_id', 'unknown')[:8] + "...",
            "error": str(e)
        }, request)
        logger.error(f"会话刷新过程中发生错误: {e}")
        rate_limiter.record_failed_attempt(client_ip, max_attempts=10, block_duration=300)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="会话刷新失败，请稍后重试"
        )

# 检查会话过期API
@router.post("/check_session_expiry", response_model=dict)
async def check_session_expiry(validate_request: ValidateSessionRequest, request: Request, warning_threshold: int = 5):
    session_id = validate_request.session_id
    
    # 获取客户端信息
    client_info = await get_client_info(request)
    
    result = session_service.validate_session(session_id, client_info)
    if not result['valid']:
        return {
            "valid": False,
            "message": "无效的会话ID或会话已过期",
            "hijacked": False
        }
    
    # 更新会话的最后活动时间
    session_service.update_session_activity(session_id)
    
    remaining_time = result['expire_time'] - datetime.utcnow()
    remaining_minutes = remaining_time.total_seconds() / 60
    
    response = {
        "valid": True,
        "remaining_minutes": remaining_minutes,
        "is_about_to_expire": remaining_minutes < warning_threshold
    }
    
    # 如果检测到会话劫持
    if result['hijacked']:
        response["hijacked"] = True
        response["message"] = "检测到异常登录，会话可能已被劫持"
        # 在实际应用中，可能需要自动结束被劫持的会话
        # session_service.end_session(session_id, reason="hijacked")
    
    return response

# 强制退出用户所有会话API
@router.post("/force_logout", response_model=dict)
async def force_logout(request: Request):
    """强制退出指定用户的所有会话

    参数:
        username: 要强制退出的用户名

    返回:
        包含成功信息和被强制退出的会话数量的字典
    """
    # 获取当前用户
    current_user = await get_current_user(request)
    username = current_user.username

    count = session_service.end_user_sessions(username)

    return {
        "message": f"成功强制退出用户 {username} 的所有会话",
        "session_count": count
    }

# 管理员强制退出指定用户所有会话API
@router.post("/admin/force_logout/{username}", response_model=dict)
async def admin_force_logout(username: str, current_user: User = Depends(get_current_user)):
    """管理员强制退出指定用户的所有会话

    参数:
        username: 要强制退出的用户名
        current_user: 当前管理员用户

    返回:
        包含成功信息和被强制退出的会话数量的字典
    """
    # 这里可以添加管理员权限检查逻辑
    count = session_service.end_user_sessions(username)

    return {
        "message": f"管理员成功强制退出用户 {username} 的所有会话",
        "session_count": count
    }

# 全局强制退出所有用户会话API
@router.post("/admin/force_logout_all", response_model=dict)
async def admin_force_logout_all(current_user: User = Depends(get_current_user)):
    """管理员强制退出所有用户的所有会话

    参数:
        current_user: 当前管理员用户

    返回:
        包含成功信息和被强制退出的会话数量的字典
    """
    # 这里可以添加管理员权限检查逻辑
    session_count = session_service.get_active_session_count()
    session_service.clear_all_sessions()

    return {
        "message": f"管理员成功强制退出所有用户的所有会话",
        "session_count": session_count
    }



# 获取活跃会话数量API
@router.get("/active_sessions", response_model=dict)
async def get_active_sessions():
    count = get_active_session_count()
    return {"active_session_count": count}

# 获取会话设备类型API
@router.post("/device_info", response_model=dict)
async def get_device_info(validate_request: ValidateSessionRequest):
    session_id = validate_request.session_id
    device_info = session_service.get_session_device_type(session_id)
    if device_info:
        return {
            "success": True,
            "device_info": device_info
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在或已过期"
        )

# 检查用户是否为管理员
@router.post("/is_admin", response_model=dict)
async def check_is_admin(validate_request: ValidateSessionRequest, current_user: User = Depends(get_current_user)):
    # 验证会话
    session_id = validate_request.session_id
    result = session_service.validate_session(session_id)
    if not result['valid']:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的会话ID或会话已过期"
        )
    
    # 使用会话验证结果中的用户名进行管理员检查
    username = result['username']
    admin_status = is_admin_user(username)
    
    return {
        "is_admin": admin_status,
        "username": username
    }

# 密码强度验证API
@router.post("/validate_password_strength", response_model=dict)
async def validate_password_strength(request: dict):
    """验证密码强度
    
    Args:
        request: 包含encrypted_password字段的请求
        
    Returns:
        密码强度验证结果
    """
    encrypted_password = request.get('encrypted_password')
    if not encrypted_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少encrypted_password字段"
        )
    
    try:
        # 解密密码
        password = decrypt_password(encrypted_password)
        
        # 验证密码强度
        strength_result = password_service.validate_password_strength(password)
        
        return {
            "success": True,
            "strength": strength_result
        }
    except Exception as e:
        logger.error(f"密码强度验证失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"密码强度验证失败: {str(e)}"
        )

# 生成安全密码API
@router.post("/generate_secure_password", response_model=dict)
async def generate_secure_password(request: dict = None):
    """生成安全密码
    
    Args:
        request: 可选的请求参数，包含length字段
        
    Returns:
        生成的安全密码（加密后）
    """
    length = 16  # 默认长度
    if request and 'length' in request:
        length = max(8, min(64, request['length']))  # 限制长度在8-64之间
    
    try:
        # 生成安全密码
        secure_password = password_service.generate_secure_password(length)
        
        # 加密密码（与前端格式一致）
        encrypted_password = password_service.encrypt_password(secure_password)
        
        # 验证强度
        strength_result = password_service.validate_password_strength(secure_password)
        
        return {
            "success": True,
            "encrypted_password": encrypted_password,
            "strength": strength_result['strength'],
            "length": len(secure_password)
        }
    except Exception as e:
        logger.error(f"生成安全密码失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成安全密码失败: {str(e)}"
        )

# 密码重置令牌生成API
@router.post("/request_password_reset", response_model=dict)
@rate_limit(max_requests=3, window_seconds=600, per_ip=True)  # 10分钟内最多3次重置请求
async def request_password_reset(request: dict, req: Request):
    """请求密码重置
    
    Args:
        request: 包含username字段的请求
        req: FastAPI请求对象
        
    Returns:
        重置令牌信息
    """
    client_ip = get_client_ip(req)
    
    try:
        username = request.get('username')
        if not username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少username字段"
            )
        
        # 增强的用户名验证
        username_validation = InputValidator.validate_username(username)
        if not username_validation['valid']:
            log_security_event("password_reset_invalid_username", {
                "username": username,
                "error": username_validation['error']
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=3, block_duration=1800)  # 30分钟封禁
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名格式错误"
            )
        
        # 清理和转义用户名
        username = InputValidator.sanitize_input(username)
        
        # 验证用户是否存在
        user = await get_user(username)
        if not user:
            # 记录可疑的重置请求
            log_security_event("password_reset_nonexistent_user", {
                "username": username
            }, req)
            # 为了安全，即使用户不存在也返回成功
            # 避免用户名枚举攻击
            return {
                "success": True,
                "message": "如果用户存在，重置链接已发送到注册邮箱"
            }
        
        # 生成重置令牌
        reset_token = password_service.create_password_reset_token(username)
        
        # 记录安全事件
        log_security_event("password_reset_requested", {
            "username": username,
            "reset_token": reset_token[:8] + "..."  # 只记录部分令牌用于审计
        }, req)
        
        # 在实际应用中，这里应该发送邮件给用户
        # 现在只是记录日志
        logger.info(f"为用户 {username} 生成密码重置令牌: {reset_token}, IP: {client_ip}")
        
        return {
            "success": True,
            "message": "如果用户存在，重置链接已发送到注册邮箱",
            "token": reset_token  # 在生产环境中不应该返回令牌
        }
    
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("password_reset_error", {
            "username": request.get('username', 'unknown'),
            "error": str(e)
        }, req)
        logger.error(f"密码重置请求过程中发生错误: {e}")
        rate_limiter.record_failed_attempt(client_ip, max_attempts=3, block_duration=1800)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码重置请求处理失败"
        )

# 密码重置API
@router.post("/reset_password", response_model=dict)
@rate_limit(max_requests=5, window_seconds=600, per_ip=True)  # 10分钟内最多5次重置尝试
async def reset_password(request: dict, req: Request):
    """重置密码
    
    Args:
        request: 包含token、username和new_password字段的请求
        req: FastAPI请求对象
        
    Returns:
        重置结果
    """
    client_ip = get_client_ip(req)
    
    try:
        token = request.get('token')
        username = request.get('username')
        encrypted_new_password = request.get('new_password')
        
        if not all([token, username, encrypted_new_password]):
            log_security_event("password_reset_missing_fields", {
                "missing_fields": [k for k in ['token', 'username', 'new_password'] if not request.get(k)]
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)  # 30分钟封禁
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少必要字段：token、username、new_password"
            )
        
        # 验证令牌格式
        token_validation = InputValidator.validate_session_id(token)
        if not token_validation['valid']:
            log_security_event("password_reset_invalid_token_format", {
                "token": token[:8] + "...",
                "error": token_validation['error']
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="重置令牌格式无效"
            )
        
        # 验证用户名格式
        username_validation = InputValidator.validate_username(username)
        if not username_validation['valid']:
            log_security_event("password_reset_invalid_username", {
                "username": username,
                "error": username_validation['error']
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名格式错误"
            )
        
        # 清理输入
        token = InputValidator.sanitize_input(token)
        username = InputValidator.sanitize_input(username)
        encrypted_new_password = InputValidator.sanitize_input(encrypted_new_password)
        
        # 验证重置令牌
        if not password_service.verify_reset_token(token, username):
            log_security_event("password_reset_invalid_token", {
                "username": username,
                "token": token[:8] + "..."
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效或已过期的重置令牌"
            )
        
        # 解密新密码
        try:
            new_password = decrypt_password(encrypted_new_password)
        except Exception as e:
            log_security_event("password_reset_decrypt_failed", {
                "username": username,
                "error": str(e)
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码格式错误"
            )
        
        # 验证新密码格式
        password_validation = InputValidator.validate_password_format(new_password)
        if not password_validation['valid']:
            log_security_event("password_reset_invalid_password_format", {
                "username": username,
                "error": password_validation['error']
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"密码格式错误: {password_validation['error']}"
            )
        
        # 验证新密码强度
        strength_result = password_service.validate_password_strength(new_password)
        if not strength_result['valid']:
            log_security_event("password_reset_weak_password", {
                "username": username,
                "strength_issues": strength_result['issues']
            }, req)
            rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"密码强度不足: {', '.join(strength_result['issues'])}"
            )
        
        # 更新密码（这里需要实现实际的密码更新逻辑）
        # 在实际应用中，应该调用数据库服务更新密码
        
        # 记录成功的密码重置
        log_security_event("password_reset_success", {
            "username": username,
            "token": token[:8] + "..."
        }, req)
        logger.info(f"用户 {username} 密码重置成功, IP: {client_ip}")
        
        # 强制退出该用户的所有会话
        session_service.end_user_sessions(username)
        
        return {
            "success": True,
            "message": "密码重置成功，请重新登录"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("password_reset_error", {
            "username": request.get('username', 'unknown'),
            "error": str(e)
        }, req)
        logger.error(f"密码重置失败: {e}")
        rate_limiter.record_failed_attempt(client_ip, max_attempts=5, block_duration=1800)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码重置失败，请稍后重试"
        )

# 更改密码API
@router.post("/change_password", response_model=dict)
@rate_limit(max_requests=5, window_seconds=600, per_user=True)  # 10分钟内最多5次修改密码尝试
async def change_password(request: dict, req: Request, current_user: User = Depends(get_current_user)):
    """更改密码
    
    Args:
        request: 包含current_password和new_password字段的请求
        req: FastAPI请求对象
        current_user: 当前登录用户
        
    Returns:
        更改结果
    """
    client_ip = get_client_ip(req)
    username = current_user.username
    
    try:
        encrypted_current_password = request.get('current_password')
        encrypted_new_password = request.get('new_password')
        
        if not all([encrypted_current_password, encrypted_new_password]):
            log_security_event("password_change_missing_fields", {
                "username": username,
                "missing_fields": [k for k in ['current_password', 'new_password'] if not request.get(k)]
            }, req)
            rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)  # 30分钟封禁
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少必要字段：current_password、new_password"
            )
        
        # 清理输入
        encrypted_current_password = InputValidator.sanitize_input(encrypted_current_password)
        encrypted_new_password = InputValidator.sanitize_input(encrypted_new_password)
        
        # 解密密码
        try:
            current_password = decrypt_password(encrypted_current_password)
            new_password = decrypt_password(encrypted_new_password)
        except Exception as e:
            log_security_event("password_change_decrypt_failed", {
                "username": username,
                "error": str(e)
            }, req)
            rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码格式错误"
            )
        
        # 验证当前密码格式
        current_password_validation = InputValidator.validate_password_format(current_password)
        if not current_password_validation['valid']:
            log_security_event("password_change_invalid_current_password", {
                "username": username,
                "error": current_password_validation['error']
            }, req)
            rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码格式错误"
            )
        
        # 验证新密码格式
        new_password_validation = InputValidator.validate_password_format(new_password)
        if not new_password_validation['valid']:
            log_security_event("password_change_invalid_new_password", {
                "username": username,
                "error": new_password_validation['error']
            }, req)
            rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"新密码格式错误: {new_password_validation['error']}"
            )
        
        # 验证当前密码
        if not await verify_user(username, current_password):
            log_security_event("password_change_wrong_current_password", {
                "username": username
            }, req)
            rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="当前密码错误"
            )
        
        # 检查新密码是否与当前密码相同
        if current_password == new_password:
            log_security_event("password_change_same_password", {
                "username": username
            }, req)
            rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="新密码不能与当前密码相同"
            )
        
        # 验证新密码强度
        strength_result = password_service.validate_password_strength(new_password)
        if not strength_result['valid']:
            log_security_event("password_change_weak_password", {
                "username": username,
                "strength_issues": strength_result['issues']
            }, req)
            rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"新密码强度不足: {', '.join(strength_result['issues'])}"
            )
        
        # 更新密码（这里需要实现实际的密码更新逻辑）
        # 在实际应用中，应该调用数据库服务更新密码
        
        # 记录成功的密码修改
        log_security_event("password_change_success", {
            "username": username
        }, req)
        logger.info(f"用户 {username} 密码更改成功, IP: {client_ip}")
        
        # 强制退出该用户的其他会话（可选）
        # session_service.end_user_sessions(username, exclude_current=True)
        
        return {
            "success": True,
            "message": "密码更改成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("password_change_error", {
            "username": username,
            "error": str(e)
        }, req)
        logger.error(f"用户 {username} 密码更改过程中发生错误: {e}")
        rate_limiter.record_failed_attempt(username, max_attempts=5, block_duration=1800)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码更改失败，请稍后重试"
        )

# 受保护的路由示例
@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user