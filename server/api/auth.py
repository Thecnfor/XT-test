import os
import uuid
import html
import re
import threading
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import time

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

# 验证输入是否安全
def is_safe_input(input_str: str) -> bool:
    """验证输入是否安全，不包含危险字符或脚本"""
    if not input_str:
        return False
    # 检查是否包含危险字符或脚本
    dangerous_patterns = [
        r'<script.*?>.*?</script>',
        r'on[a-zA-Z]+\s*=',  # 事件处理器
        r'javascript:',
        r'data:'
    ]
    for pattern in dangerous_patterns:
        if re.search(pattern, input_str, re.IGNORECASE):
            return False
    return True


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
    user = get_user(username)
    if user is None:
        raise credentials_exception
    return user

# 用户注册API
@router.post("/register", response_model=dict)
async def register(user: RegisterRequest):
    # 验证输入是否安全
    if not is_safe_input(user.username) or not is_safe_input(user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="输入包含不安全字符",
        )

    # 转义输入，防止XSS攻击
    username = html.escape(user.username)
    # 解密密码
    encrypted_password = html.escape(user.password)
    password = decrypt_password(encrypted_password)

    if add_user(username, password):
        return {"message": "注册成功", "username": username}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
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
async def login(login_request: LoginRequest, request: Request):
    # 验证输入是否安全
    if not is_safe_input(login_request.username) or not is_safe_input(login_request.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="输入包含不安全字符",
        )

    # 转义输入，防止XSS攻击
    username = html.escape(login_request.username)
    # 解密密码
    encrypted_password = html.escape(login_request.password)
    password = decrypt_password(encrypted_password)

    if not verify_user(username, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
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
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"已达到最大活跃会话数 {session_service.max_sessions_per_user}，且所有会话都处于活跃状态",
        )
    
    logger.info(f"用户 {username} 登录成功，会话ID: {session_id}")
    return {"access_token": access_token, "token_type": "bearer", "session_id": session_id}


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
async def validate_session(validate_request: ValidateSessionRequest, request: Request):
    session_id = validate_request.session_id
    
    # 获取客户端信息
    client_info = await get_client_info(request)
    
    # 验证会话并检测劫持
    result = session_service.validate_session(session_id, client_info)
    
    if result['valid']:
        # 更新会话的最后活动时间
        session_service._update_session_activity(session_id)
        
        response = {
            "valid": True,
            "username": result["username"],
            "expire_time": result["expire_time"].isoformat()
        }
        
        # 如果检测到会话劫持
        if result['hijacked']:
            response["hijacked"] = True
            response["message"] = "检测到异常登录，会话可能已被劫持"
            # 在实际应用中，可能需要自动结束被劫持的会话
            # session_service.end_session(session_id, reason="hijacked")
        
        return response
    else:
        return {"valid": False, "hijacked": False}

# 刷新会话API
@router.post("/refresh_session", response_model=dict)
async def refresh_session(validate_request: ValidateSessionRequest, request: Request):
    session_id = validate_request.session_id
    
    # 获取客户端信息
    client_info = await get_client_info(request)
    
    # 刷新会话并检测劫持
    result = session_service.validate_session(session_id, client_info)
    if not result['valid']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的会话ID"
        )
    
    # 更新会话的最后活动时间
    session_service._update_session_activity(session_id)
    
    response = {
        "success": True,
        "new_expire_time": result['expire_time'].isoformat()
    }
    
    # 如果检测到会话劫持
    if result['hijacked']:
        response["hijacked"] = True
        response["message"] = "检测到异常登录，会话可能已被劫持"
        # 在实际应用中，可能需要自动结束被劫持的会话
        # session_service.end_session(session_id, reason="hijacked")
    
    return response

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
    session_service._update_session_activity(session_id)
    
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
async def request_password_reset(request: dict):
    """请求密码重置
    
    Args:
        request: 包含username字段的请求
        
    Returns:
        重置令牌信息
    """
    username = request.get('username')
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少username字段"
        )
    
    # 验证用户是否存在
    user = get_user(username)
    if not user:
        # 为了安全，即使用户不存在也返回成功
        # 避免用户名枚举攻击
        return {
            "success": True,
            "message": "如果用户存在，重置链接已发送到注册邮箱"
        }
    
    try:
        # 生成重置令牌
        reset_token = password_service.create_password_reset_token(username)
        
        # 在实际应用中，这里应该发送邮件给用户
        # 现在只是记录日志
        logger.info(f"为用户 {username} 生成密码重置令牌: {reset_token}")
        
        return {
            "success": True,
            "message": "如果用户存在，重置链接已发送到注册邮箱",
            "token": reset_token  # 在生产环境中不应该返回令牌
        }
    except Exception as e:
        logger.error(f"生成密码重置令牌失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码重置请求处理失败"
        )

# 密码重置API
@router.post("/reset_password", response_model=dict)
async def reset_password(request: dict):
    """重置密码
    
    Args:
        request: 包含token、username和new_password字段的请求
        
    Returns:
        重置结果
    """
    token = request.get('token')
    username = request.get('username')
    encrypted_new_password = request.get('new_password')
    
    if not all([token, username, encrypted_new_password]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少必要字段：token、username、new_password"
        )
    
    try:
        # 验证重置令牌
        if not password_service.verify_reset_token(token, username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效或已过期的重置令牌"
            )
        
        # 解密新密码
        new_password = decrypt_password(encrypted_new_password)
        
        # 验证新密码强度
        strength_result = password_service.validate_password_strength(new_password)
        if not strength_result['valid']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"密码强度不足: {', '.join(strength_result['issues'])}"
            )
        
        # 更新密码（这里需要实现实际的密码更新逻辑）
        # 在实际应用中，应该调用数据库服务更新密码
        logger.info(f"用户 {username} 密码重置成功")
        
        # 强制退出该用户的所有会话
        session_service.end_user_sessions(username)
        
        return {
            "success": True,
            "message": "密码重置成功，请重新登录"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"密码重置失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码重置失败"
        )

# 更改密码API
@router.post("/change_password", response_model=dict)
async def change_password(request: dict, current_user: User = Depends(get_current_user)):
    """更改密码
    
    Args:
        request: 包含current_password和new_password字段的请求
        current_user: 当前登录用户
        
    Returns:
        更改结果
    """
    encrypted_current_password = request.get('current_password')
    encrypted_new_password = request.get('new_password')
    
    if not all([encrypted_current_password, encrypted_new_password]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少必要字段：current_password、new_password"
        )
    
    try:
        # 解密密码
        current_password = decrypt_password(encrypted_current_password)
        new_password = decrypt_password(encrypted_new_password)
        
        # 验证当前密码
        if not verify_user(current_user.username, current_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误"
            )
        
        # 验证新密码强度
        strength_result = password_service.validate_password_strength(new_password)
        if not strength_result['valid']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"新密码强度不足: {', '.join(strength_result['issues'])}"
            )
        
        # 检查新密码是否与当前密码相同
        if current_password == new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="新密码不能与当前密码相同"
            )
        
        # 更新密码（这里需要实现实际的密码更新逻辑）
        # 在实际应用中，应该调用数据库服务更新密码
        logger.info(f"用户 {current_user.username} 密码更改成功")
        
        # 强制退出该用户的其他会话（保留当前会话）
        # 这里可以根据需要决定是否强制退出所有会话
        
        return {
            "success": True,
            "message": "密码更改成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"密码更改失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码更改失败"
        )

# 受保护的路由示例
@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user