import json
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("session_service")

class SessionService:
    def __init__(self, session_file: str, session_expire_minutes: int):
        self.session_file = session_file
        self.session_expire_minutes = session_expire_minutes
        self.active_sessions: Dict[str, Dict] = {}
        self._initialize_sessions()

    def _initialize_sessions(self):
        """初始化会话服务，加载现有会话并清理过期会话"""
        self._load_sessions()
        self._cleanup_expired_sessions()
        self._save_sessions()
        logger.info(f"会话服务初始化完成，当前活跃会话数: {len(self.active_sessions)}")

    def _load_sessions(self):
        """从文件加载会话数据"""
        if os.path.exists(self.session_file):
            try:
                with open(self.session_file, 'r') as f:
                    sessions_data = json.load(f)
                    for session_id, session in sessions_data.items():
                        try:
                            session['expire_time'] = datetime.fromisoformat(session['expire_time'])
                            session['created_at'] = datetime.fromisoformat(session['created_at'])
                            self.active_sessions[session_id] = session
                        except (ValueError, KeyError) as e:
                            logger.warning(f"无效的会话数据 {session_id}: {e}")
            except json.JSONDecodeError as e:
                logger.error(f"会话文件格式错误: {e}")
                self.active_sessions = {}
        else:
            logger.info(f"会话文件 {self.session_file} 不存在，将创建新文件")
            self.active_sessions = {}

    def _save_sessions(self):
        """将会话数据保存到文件"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.session_file), exist_ok=True)
            
            # 转换datetime对象为字符串
            sessions_data = {}
            for session_id, session in self.active_sessions.items():
                sessions_data[session_id] = {
                    'username': session['username'],
                    'expire_time': session['expire_time'].isoformat(),
                    'created_at': session['created_at'].isoformat()
                }
            
            with open(self.session_file, 'w') as f:
                json.dump(sessions_data, f, indent=2)
            logger.debug(f"成功保存 {len(sessions_data)} 个会话到文件")
        except Exception as e:
            logger.error(f"保存会话失败: {e}")

    def _cleanup_expired_sessions(self):
        """清理过期会话"""
        current_time = datetime.utcnow()
        expired_sessions = [
            session_id for session_id, session in self.active_sessions.items()
            if session["expire_time"] < current_time
        ]
        for session_id in expired_sessions:
            del self.active_sessions[session_id]
        if expired_sessions:
            logger.info(f"清理了 {len(expired_sessions)} 个过期会话")
            return True
        return False

    def create_session(self, username: str) -> str:
        """创建新会话并返回会话ID"""
        session_id = str(uuid.uuid4())
        expire_time = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
        self.active_sessions[session_id] = {
            "username": username,
            "expire_time": expire_time,
            "created_at": datetime.utcnow()
        }
        self._save_sessions()
        logger.info(f"为用户 {username} 创建新会话: {session_id}")
        return session_id

    def end_session(self, session_id: str) -> bool:
        """结束会话"""
        if session_id in self.active_sessions:
            username = self.active_sessions[session_id]["username"]
            del self.active_sessions[session_id]
            self._save_sessions()
            logger.info(f"结束用户 {username} 的会话: {session_id}")
            return True
        logger.warning(f"尝试结束不存在的会话: {session_id}")
        return False

    def validate_session(self, session_id: str) -> Dict:
        """验证会话有效性并延长有效期"""
        self._cleanup_expired_sessions()
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            # 延长会话有效期
            session["expire_time"] = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
            self._save_sessions()
            logger.debug(f"会话 {session_id} 验证有效，已延长有效期")
            return {
                "valid": True,
                "username": session["username"],
                "expire_time": session["expire_time"]
            }
        logger.warning(f"无效的会话ID: {session_id}")
        return {"valid": False}

    def get_active_session_count(self) -> int:
        """获取当前活跃会话数量"""
        self._cleanup_expired_sessions()
        return len(self.active_sessions)

    def get_user_sessions(self, username: str) -> List[Dict]:
        """获取指定用户的所有活跃会话"""
        self._cleanup_expired_sessions()
        return [
            {"session_id": session_id, "expire_time": session["expire_time"]}
            for session_id, session in self.active_sessions.items()
            if session["username"] == username
        ]

    def end_user_sessions(self, username: str) -> int:
        """结束指定用户的所有会话"""
        self._cleanup_expired_sessions()
        user_sessions = self.get_user_sessions(username)
        for session in user_sessions:
            self.end_session(session["session_id"])
        logger.info(f"结束了用户 {username} 的 {len(user_sessions)} 个会话")
        return len(user_sessions)