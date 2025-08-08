import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

from schemas.user import User, RegisterRequest, LoginRequest
from services.database_service import add_user, verify_user, get_user
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, SESSION_EXPIRE_MINUTES

# 会话相关请求模型
class LogoutRequest(BaseModel):
    session_id: str

class ValidateSessionRequest(BaseModel):
    session_id: str

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

def create_session(username: str) -> str:
    """创建新会话并返回会话ID"""
    session_id = str(uuid.uuid4())
    expire_time = datetime.utcnow() + timedelta(minutes=SESSION_EXPIRE_MINUTES)
    active_sessions[session_id] = {
        "username": username,
        "expire_time": expire_time,
        "created_at": datetime.utcnow()
    }
    save_sessions()  # 保存到文件
    return session_id


def end_session(session_id: str) -> bool:
    """结束会话"""
    if session_id in active_sessions:
        del active_sessions[session_id]
        save_sessions()  # 保存到文件
        return True
    return False


def cleanup_expired_sessions():
    """清理过期会话"""
    current_time = datetime.utcnow()
    expired_sessions = [
        session_id for session_id, session in active_sessions.items()
        if session["expire_time"] < current_time
    ]
    for session_id in expired_sessions:
        del active_sessions[session_id]
    if expired_sessions:
        save_sessions()  # 如果有删除操作，保存到文件

# 初始化加载会话
def initialize_sessions():
    load_sessions()
    cleanup_expired_sessions()
    save_sessions()

# 初始化会话
initialize_sessions()

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
    if add_user(user.username, user.password):
        return {"message": "注册成功", "username": user.username}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

# 用户登录API - 获取令牌和会话ID
@router.post("/token", response_model=dict)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if not verify_user(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    # 创建会话
    session_id = create_session(form_data.username)
    return {"access_token": access_token, "token_type": "bearer", "session_id": session_id}


# 用户登出API - 结束会话
@router.post("/logout", response_model=dict)
async def logout(logout_request: LogoutRequest):
    session_id = logout_request.session_id
    success = end_session(session_id)
    if success:
        return {"message": "登出成功", "session_id": session_id}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的会话ID"
        )


# 获取活跃会话数量API
@router.get("/active_sessions", response_model=dict)
async def get_active_sessions():
    count = get_active_session_count()
    return {"active_session_count": count}

# 受保护的路由示例
@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


# 验证会话有效性API
@router.post("/validate_session", response_model=dict)
async def validate_session(session_id: str):
    cleanup_expired_sessions()
    if session_id in active_sessions:
        session = active_sessions[session_id]
        # 延长会话有效期
        session["expire_time"] = datetime.utcnow() + timedelta(minutes=SESSION_EXPIRE_MINUTES)
        return {
            "valid": True,
            "username": session["username"],
            "expire_time": session["expire_time"]
        }
    else:
        return {"valid": False}