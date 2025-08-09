import os
import uuid
import html
import re
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import time

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

from schemas.user import User, RegisterRequest, LoginRequest
from services.database_service import add_user, verify_user, get_user
from services.session_service import SessionService
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, SESSION_EXPIRE_MINUTES, SESSION_FILE, ENCRYPTION_KEY
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
# 初始化会话服务
session_service = SessionService(SESSION_FILE, SESSION_EXPIRE_MINUTES)

# 解密密码
def decrypt_password(encrypted_password: str) -> str:
    """解密前端加密的密码

    Args:
        encrypted_password: 前端加密后的密码字符串

    Returns:
        解密后的原始密码
    """
    try:
        # 直接使用CryptoJS兼容的方式解密
        # 注意：这里需要确保ENCRYPTION_KEY与前端完全一致
        key = ENCRYPTION_KEY.encode('utf-8')
        # CryptoJS默认使用CBC模式和PKCS7填充
        # 解析CryptoJS生成的base64编码字符串
        encrypted_data = base64.b64decode(encrypted_password)
        # 提取salt (前8字节是'Salted__', 接下来8字节是salt)
        if len(encrypted_data) < 16 or not encrypted_data.startswith(b'Salted__'):
            raise ValueError("无效的加密数据格式")
        salt = encrypted_data[8:16]
        ciphertext = encrypted_data[16:]

        # 使用PBKDF2生成密钥和IV (与CryptoJS一致)
        from Crypto.Protocol.KDF import PBKDF2
        # CryptoJS默认使用1次迭代
        key_iv = PBKDF2(key, salt, dkLen=32+16, count=1)
        key = key_iv[:32]  # AES-256需要32字节密钥
        iv = key_iv[32:]   # 16字节IV

        # 解密
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"密码解密失败: {e}")
        # 在生产环境中应该抛出异常
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"密码解密失败: {str(e)}"
        )

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
    print("会话清理线程已启动")

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
    
    # 创建会话
    session_id = session_service.create_session(username, session_attributes)
    
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

# 验证会话API
@router.post("/validate_session", response_model=dict)
async def validate_session(validate_request: ValidateSessionRequest):
    session_id = validate_request.session_id
    # 验证会话并更新最后活动时间
    result = session_service.validate_session(session_id)
    if result['valid']:
        # 更新会话的最后活动时间
        session_service._update_session_activity(session_id)
        return {
            "valid": True,
            "username": result["username"],
            "expire_time": result["expire_time"].isoformat()
        }
    else:
        return {"valid": False}

# 刷新会话API
@router.post("/refresh_session", response_model=dict)
async def refresh_session(validate_request: ValidateSessionRequest):
    session_id = validate_request.session_id
    
    # 刷新会话并更新最后活动时间
    result = session_service.validate_session(session_id)
    if not result['valid']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的会话ID"
        )
    
    # 更新会话的最后活动时间
    session_service._update_session_activity(session_id)
    
    return {
        "success": True,
        "new_expire_time": result['expire_time'].isoformat()
    }

# 检查会话过期API
@router.post("/check_session_expiry", response_model=dict)
async def check_session_expiry(validate_request: ValidateSessionRequest, warning_threshold: int = 5):
    session_id = validate_request.session_id
    
    result = session_service.validate_session(session_id)
    if not result['valid']:
        return {
            "valid": False,
            "message": "无效的会话ID或会话已过期"
        }
    
    # 更新会话的最后活动时间
    session_service._update_session_activity(session_id)
    
    remaining_time = result['expire_time'] - datetime.utcnow()
    remaining_minutes = remaining_time.total_seconds() / 60
    
    return {
        "valid": True,
        "remaining_minutes": remaining_minutes,
        "is_about_to_expire": remaining_minutes < warning_threshold
    }

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

# 受保护的路由示例
@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# 已移除重复的路由定义