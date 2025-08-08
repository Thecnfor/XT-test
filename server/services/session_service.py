import os
import json
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
        # 新结构: { username: { sessions: { session_id: { ...session_data } } } }
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
                    self.active_sessions = {}
                    for username, user_data in sessions_data.items():
                        if 'sessions' not in user_data:
                            continue
                        self.active_sessions[username] = {'sessions': {}}
                        for session_id, session in user_data['sessions'].items():
                            try:
                                session['expire_time'] = datetime.fromisoformat(session['expire_time'])
                                session['created_at'] = datetime.fromisoformat(session['created_at'])
                                self.active_sessions[username]['sessions'][session_id] = session
                            except (ValueError, KeyError) as e:
                                logger.warning(f"用户 {username} 的无效会话数据 {session_id}: {e}")
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
            for username, user_data in self.active_sessions.items():
                if 'sessions' not in user_data or not user_data['sessions']:
                    continue
                sessions_data[username] = {'sessions': {}}
                for session_id, session in user_data['sessions'].items():
                    session_data = {
                        'expire_time': session['expire_time'].isoformat(),
                        'created_at': session['created_at'].isoformat()
                    }
                    # 添加last_activity字段(如果存在)
                    if 'last_activity' in session:
                        session_data['last_activity'] = session['last_activity'].isoformat()
                    # 添加其他会话属性
                    for key, value in session.items():
                        if key not in ['expire_time', 'created_at', 'last_activity']:
                            session_data[key] = value
                    sessions_data[username]['sessions'][session_id] = session_data
            
            with open(self.session_file, 'w') as f:
                json.dump(sessions_data, f, indent=2)
            logger.debug(f"成功保存 {len(sessions_data)} 个用户的会话到文件")
        except Exception as e:
            logger.error(f"保存会话失败: {e}")

    def _cleanup_expired_sessions(self):
        """清理过期会话"""
        current_time = datetime.utcnow()
        cleaned_up = False
        
        # 遍历所有用户
        for username in list(self.active_sessions.keys()):
            user_data = self.active_sessions[username]
            if 'sessions' not in user_data:
                del self.active_sessions[username]
                cleaned_up = True
                continue
            
            # 找出过期的会话
            expired_sessions = [
                session_id for session_id, session in user_data['sessions'].items()
                if session["expire_time"] < current_time
            ]
            
            # 删除过期会话
            for session_id in expired_sessions:
                del user_data['sessions'][session_id]
                cleaned_up = True
            
            # 如果用户没有会话了，删除用户
            if not user_data['sessions']:
                del self.active_sessions[username]
                cleaned_up = True
        
        if cleaned_up:
            logger.info("清理了过期会话")
            return True
        return False

    def create_session(self, username: str, session_attributes: Dict = None) -> str:
        """创建新会话并返回会话ID

        参数:
            username: 用户名
            session_attributes: 会话属性字典，包含浏览器指纹、IP、设备信息等

        返回:
            会话ID
        """
        session_id = str(uuid.uuid4())
        expire_time = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
        
        # 如果用户不存在，创建用户条目
        if username not in self.active_sessions:
            self.active_sessions[username] = {'sessions': {}}
        
        # 初始化会话数据
        session_data = {
            "expire_time": expire_time,
            "created_at": datetime.utcnow()
        }
        
        # 添加额外的会话属性
        if session_attributes:
            session_data.update(session_attributes)
        
        # 添加会话
        self.active_sessions[username]['sessions'][session_id] = session_data
        
        self._save_sessions()
        logger.info(f"为用户 {username} 创建新会话: {session_id}")
        return session_id

    def end_session(self, session_id: str) -> bool:
        """结束会话"""
        # 查找会话属于哪个用户
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                # 删除会话
                del user_data['sessions'][session_id]
                
                # 如果用户没有会话了，删除用户
                if not user_data['sessions']:
                    del self.active_sessions[username]
                
                self._save_sessions()
                logger.info(f"结束用户 {username} 的会话: {session_id}")
                return True
        
        logger.warning(f"尝试结束不存在的会话: {session_id}")
        return False

    def validate_session(self, session_id: str) -> Dict:
        """验证会话有效性并延长有效期"""
        self._cleanup_expired_sessions()
        
        # 查找会话
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                # 延长会话有效期
                session["expire_time"] = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
                self._save_sessions()
                logger.debug(f"会话 {session_id} 验证有效，已延长有效期")
                return {
                    "valid": True,
                    "username": username,
                    "expire_time": session["expire_time"]
                }
        
        logger.warning(f"无效的会话ID: {session_id}")
        return {"valid": False}
    
    def _update_session_activity(self, session_id: str) -> bool:
        """更新会话的最后活动时间
        
        参数:
            session_id: 会话ID
        
        返回:
            是否成功更新
        """
        # 查找会话
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                # 更新最后活动时间
                session["last_activity"] = datetime.utcnow()
                self._save_sessions()
                logger.debug(f"更新会话 {session_id} 的最后活动时间")
                return True
        
        logger.warning(f"尝试更新不存在的会话: {session_id}")
        return False

    def get_active_session_count(self) -> int:
        """获取当前活跃会话数量"""
        self._cleanup_expired_sessions()
        count = 0
        for user_data in self.active_sessions.values():
            if 'sessions' in user_data:
                count += len(user_data['sessions'])
        return count

    def get_user_sessions(self, username: str) -> List[Dict]:
        """获取指定用户的所有活跃会话"""
        self._cleanup_expired_sessions()
        if username not in self.active_sessions or 'sessions' not in self.active_sessions[username]:
            return []
        return [
            {"session_id": session_id, "expire_time": session["expire_time"]}
            for session_id, session in self.active_sessions[username]['sessions'].items()
        ]

    def end_user_sessions(self, username: str) -> int:
        """结束指定用户的所有会话"""
        self._cleanup_expired_sessions()
        if username not in self.active_sessions or 'sessions' not in self.active_sessions[username]:
            logger.info(f"用户 {username} 没有活跃会话")
            return 0
        
        user_sessions = list(self.active_sessions[username]['sessions'].keys())
        for session_id in user_sessions:
            self.end_session(session_id)
        
        logger.info(f"结束了用户 {username} 的 {len(user_sessions)} 个会话")
        return len(user_sessions)

    def clear_all_sessions(self):
        """清除所有会话"""
        self.active_sessions = {}
        self._save_sessions()
        logger.info("已清除所有会话")