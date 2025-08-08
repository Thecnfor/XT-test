import json
import os
import uuid
import html
import re
import json
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import time

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

from schemas.user import User, RegisterRequest, LoginRequest
from services.database_service import add_user, verify_user, get_user
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, SESSION_EXPIRE_MINUTES
# 会话不活动超时时间（分钟）
SESSION_INACTIVITY_TIMEOUT = 15

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

# 会话存储 - 使用JSON文件
SESSION_FILE = "d:/Xrak/XT-test/server/session.json"

# 加载会话数据
active_sessions: Dict[str, Dict] = {}

def load_sessions():
    """从JSON文件加载会话数据"""
    global active_sessions
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, 'r') as f:
                # 将字符串时间转换回datetime对象
                sessions_data = json.load(f)
                for session_id, session in sessions_data.items():
                    session['expire_time'] = datetime.fromisoformat(session['expire_time'])
                    session['created_at'] = datetime.fromisoformat(session['created_at'])
                active_sessions = sessions_data
        except (json.JSONDecodeError, KeyError, ValueError):
            # 文件格式错误或数据损坏，重置会话
            active_sessions = {}
    else:
        active_sessions = {}

# 保存会话数据
def save_sessions():
    """将会话数据保存到JSON文件"""
    # 将datetime对象转换为字符串
    sessions_data = {}
    for session_id, session in active_sessions.items():
        sessions_data[session_id] = {
            'username': session['username'],
            'expire_time': session['expire_time'].isoformat(),
            'created_at': session['created_at'].isoformat()
        }
    with open(SESSION_FILE, 'w') as f:
        json.dump(sessions_data, f, indent=2)

import bcrypt
import time

def create_session(username: str) -> str:
    """创建新会话并返回会话ID，使用UUID+哈希方案"""
    try:
        # 使用UUID生成唯一会话ID
        session_id = str(uuid.uuid4())
        current_time = datetime.utcnow()
        expire_time = current_time + timedelta(minutes=SESSION_EXPIRE_MINUTES)
        
        # 生成随机盐和会话密钥用于验证
        salt = bcrypt.gensalt()
        session_key = bcrypt.hashpw(f"{username}:{session_id}".encode('utf-8'), salt).decode('utf-8')
        
        active_sessions[session_id] = {
            "username": username,
            "expire_time": expire_time,
            "created_at": current_time,
            "last_activity": current_time,
            "session_key": session_key,
            "salt": salt.decode('utf-8')
        }
        save_sessions()  # 保存到文件
        print(f"会话创建成功: UUID={session_id}, 用户名: {username}")
        print(f"会话密钥: {session_key}")
        return session_id
    except Exception as e:
        print(f"会话创建失败: {str(e)}")
        raise


def verify_session(session_id: str) -> bool:
    """验证会话ID的有效性"""
    try:
        if session_id not in active_sessions:
            print(f"会话不存在: {session_id}")
            return False
        
        session = active_sessions[session_id]
        # 检查会话是否过期
        if session['expire_time'] < datetime.utcnow():
            end_session(session_id)  # 删除过期会话
            print(f"会话已过期: {session_id}")
            return False
        
        # 检查会话是否长时间不活动
        if session['last_activity'] + timedelta(minutes=SESSION_INACTIVITY_TIMEOUT) < datetime.utcnow():
            end_session(session_id)  # 删除长时间不活动的会话
            print(f"会话长时间不活动已过期: {session_id}")
            return False
        
        # 更新最后活动时间
        session['last_activity'] = datetime.utcnow()
        active_sessions[session_id] = session
        save_sessions()
        return True
    except (KeyError, ValueError) as e:
        print(f"会话验证异常: {str(e)}, 会话ID: {session_id}")
        return False

def end_session(session_id: str) -> bool:
    """结束会话"""
    if session_id in active_sessions:
        del active_sessions[session_id]
        save_sessions()  # 保存到文件
        return True
    return False


def cleanup_expired_sessions():
    """清理过期会话和长时间不活动的会话"""
    current_time = datetime.utcnow()
    inactivity_timeout = timedelta(minutes=SESSION_INACTIVITY_TIMEOUT)
    expired_sessions = [
        session_id for session_id, session in active_sessions.items()
        if session["expire_time"] < current_time or 
           ("last_activity" in session and session["last_activity"] + inactivity_timeout < current_time)
    ]
    for session_id in expired_sessions:
        del active_sessions[session_id]
    if expired_sessions:
        save_sessions()  # 如果有删除操作，保存到文件
        print(f"已清理 {len(expired_sessions)} 个过期或不活动的会话")

# 初始化加载会话
def initialize_sessions():
    load_sessions()
    cleanup_expired_sessions()
    save_sessions()

# 初始化会话
initialize_sessions()

# 定期清理过期会话的线程函数
def session_cleanup_worker():
    """后台线程函数，定期清理过期会话"""
    while True:
        cleanup_expired_sessions()
        time.sleep(1800)  # 每30分钟清理一次

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
    cleanup_expired_sessions()
    return len(active_sessions)

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
async def get_current_user(token: str = Depends(oauth2_scheme)):
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
    password = html.escape(user.password)

    if add_user(username, password):
        return {"message": "注册成功", "username": username}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

# 用户登录API - 获取令牌和会话ID
@router.post("/token", response_model=dict)
async def login(login_request: LoginRequest):
    # 验证输入是否安全
    if not is_safe_input(login_request.username) or not is_safe_input(login_request.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="输入包含不安全字符",
        )

    # 转义输入，防止XSS攻击
    username = html.escape(login_request.username)
    password = html.escape(login_request.password)

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
    # 创建会话
    session_id = create_session(username)
    
    # 验证会话ID
    if not verify_session(session_id):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="会话创建失败，请重试",
        )
    
    return {"access_token": access_token, "token_type": "bearer", "session_id": session_id}


# 用户登出API - 结束会话
@router.post("/logout", response_model=dict)
async def logout(logout_request: LogoutRequest):
    session_id = logout_request.session_id
    
    # 验证会话ID
    if not verify_session(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的会话ID"
        )
    
    success = end_session(session_id)
    if success:
        return {"message": "登出成功", "session_id": session_id}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的会话ID"
        )

# 验证会话API
@router.post("/validate_session", response_model=dict)
async def validate_session(validate_request: ValidateSessionRequest):
    session_id = validate_request.session_id
    is_valid = verify_session(session_id)
    if is_valid:
        session = active_sessions[session_id]
        return {
            "valid": True,
            "username": session["username"],
            "expire_time": session["expire_time"].isoformat()
        }
    else:
        return {"valid": False}

# 刷新会话API
@router.post("/refresh_session", response_model=dict)
async def refresh_session(validate_request: ValidateSessionRequest):
    session_id = validate_request.session_id
    
    # 验证会话ID
    if not verify_session(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的会话ID"
        )
    
    # 更新会话过期时间
    session = active_sessions[session_id]
    session['expire_time'] = datetime.utcnow() + timedelta(minutes=SESSION_EXPIRE_MINUTES)
    save_sessions()  # 保存到文件
    
    return {
        "success": True,
        "new_expire_time": session['expire_time'].isoformat()
    }

# 检查会话过期API
@router.post("/check_session_expiry", response_model=dict)
async def check_session_expiry(validate_request: ValidateSessionRequest, warning_threshold: int = 5):
    session_id = validate_request.session_id
    
    # 验证会话ID
    is_valid = verify_session(session_id)
    if not is_valid:
        return {
            "valid": False,
            "message": "无效的会话ID"
        }
    
    session = active_sessions[session_id]
    remaining_time = session['expire_time'] - datetime.utcnow()
    remaining_minutes = remaining_time.total_seconds() / 60
    
    return {
        "valid": True,
        "remaining_minutes": remaining_minutes,
        "is_about_to_expire": remaining_minutes < warning_threshold
    }

# 强制退出用户所有会话API
@router.post("/force_logout", response_model=dict)
async def force_logout(username: str = Depends(get_current_user)):
    """强制退出指定用户的所有会话

    参数:
        username: 要强制退出的用户名

    返回:
        包含成功信息和被强制退出的会话数量的字典
    """
    # 如果没有提供用户名，使用当前用户
    if not username:
        current_user = await get_current_user()
        username = current_user.username

    # 查找该用户的所有会话
    user_sessions = [
        session_id for session_id, session in active_sessions.items()
        if session["username"] == username
    ]

    # 结束所有会话
    for session_id in user_sessions:
        end_session(session_id)

    return {
        "message": f"成功强制退出用户 {username} 的所有会话",
        "session_count": len(user_sessions)
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
    # 查找该用户的所有会话
    user_sessions = [
        session_id for session_id, session in active_sessions.items()
        if session["username"] == username
    ]

    # 结束所有会话
    for session_id in user_sessions:
        end_session(session_id)

    return {
        "message": f"管理员成功强制退出用户 {username} 的所有会话",
        "session_count": len(user_sessions)
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
    session_count = len(active_sessions)
    active_sessions.clear()
    save_sessions()

    return {
        "message": f"管理员成功强制退出所有用户的所有会话",
        "session_count": session_count
    }



# 获取活跃会话数量API
@router.get("/active_sessions", response_model=dict)
async def get_active_sessions():
    count = get_active_session_count()
    return {"active_session_count": count}

# 受保护的路由示例
@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# 已移除重复的路由定义