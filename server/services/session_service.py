import os
import json
import uuid
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, List

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("session_service")

class SessionService:
    def __init__(self, session_file: str, session_expire_minutes: int):
        self.session_file = session_file
        self.session_expire_minutes = session_expire_minutes
        self.max_sessions_per_user = 5  # 每个用户最大会话数
        self.inactivity_threshold_minutes = 15  # 非活跃会话阈值(分钟)
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
                                # 确保expire_time和created_at是datetime对象
                                if isinstance(session['expire_time'], str):
                                    session['expire_time'] = datetime.fromisoformat(session['expire_time'])
                                if isinstance(session['created_at'], str):
                                    session['created_at'] = datetime.fromisoformat(session['created_at'])
                                # 处理last_activity字段
                                if 'last_activity' in session and isinstance(session['last_activity'], str):
                                    session['last_activity'] = datetime.fromisoformat(session['last_activity'])
                                self.active_sessions[username]['sessions'][session_id] = session
                            except (ValueError, KeyError) as e:
                                logger.warning(f"用户 {username} 的无效会话数据 {session_id}: {e}")
            except json.JSONDecodeError as e:
                logger.error(f"会话文件格式错误: {e}")
                self.active_sessions = {}
        else:
            logger.info(f"会话文件 {self.session_file} 不存在，将创建新文件")
            self.active_sessions = {}

    def _convert_datetime_to_str(self, data):
        """递归转换数据中的datetime对象为字符串"""
        if isinstance(data, datetime):
            return data.isoformat()
        elif isinstance(data, dict):
            result = {}
            for k, v in data.items():
                result[k] = self._convert_datetime_to_str(v)
            return result
        elif isinstance(data, list):
            return [self._convert_datetime_to_str(item) for item in data]
        return data

    def _save_sessions(self):
        """将会话数据保存到文件"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.session_file), exist_ok=True)
            
            # 使用递归方法转换所有datetime对象
            sessions_data = self._convert_datetime_to_str(self.active_sessions.copy())
            
            with open(self.session_file, 'w') as f:
                json.dump(sessions_data, f, indent=2)
            logger.debug(f"成功保存 {len(sessions_data)} 个用户的会话到文件")
        except Exception as e:
            logger.error(f"保存会话失败: {e}")
            # 打印详细错误信息，帮助调试
            import traceback
            logger.error(f"保存会话失败详细信息: {traceback.format_exc()}")

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

    def _is_session_active(self, session: Dict) -> bool:
        """判断会话是否活跃

        参数:
            session: 会话数据

        返回:
            是否活跃
        """
        if 'last_activity' not in session:
            # 如果没有活动记录，认为是新会话，是活跃的
            return True
        
        # 计算最后活动时间到现在的分钟数
        inactivity_minutes = (datetime.utcnow() - session['last_activity']).total_seconds() / 60
        return inactivity_minutes < self.inactivity_threshold_minutes

    def _get_least_active_session(self, username: str) -> Optional[str]:
        """获取用户最不活跃的会话ID

        参数:
            username: 用户名

        返回:
            最不活跃的会话ID，如果没有则返回None
        """
        if username not in self.active_sessions or 'sessions' not in self.active_sessions[username]:
            return None
        
        user_sessions = self.active_sessions[username]['sessions']
        # 按最后活动时间排序，找出最不活跃的会话
        sorted_sessions = sorted(
            user_sessions.items(),
            key=lambda x: x[1].get('last_activity', x[1]['created_at'])
        )
        
        # 检查是否有非活跃会话
        for session_id, session in sorted_sessions:
            if not self._is_session_active(session):
                return session_id
        
        # 如果所有会话都活跃，返回None
        return None

    def _check_and_cleanup_user_sessions(self, username: str) -> bool:
        """检查用户会话数，清理非活跃会话

        参数:
            username: 用户名

        返回:
            是否允许创建新会话
        """
        if username not in self.active_sessions or 'sessions' not in self.active_sessions[username]:
            return True
        
        user_sessions = self.active_sessions[username]['sessions']
        
        # 如果会话数小于最大限制，允许创建
        if len(user_sessions) < self.max_sessions_per_user:
            return True
        
        # 尝试删除最不活跃的会话
        least_active_session_id = self._get_least_active_session(username)
        if least_active_session_id:
            self.end_session(least_active_session_id)
            return True
        
        # 如果所有会话都活跃且达到最大限制，不允许创建
        logger.warning(f"用户 {username} 已达到最大活跃会话数 {self.max_sessions_per_user}")
        return False

    def create_session(self, username: str, session_attributes: Dict = None) -> Optional[str]:
        """创建新会话并返回会话ID

        参数:
            username: 用户名
            session_attributes: 会话属性字典，包含浏览器指纹、IP、设备信息等

        返回:
            会话ID，如果不允许创建则返回None
        """
        # 检查是否允许创建新会话
        if not self._check_and_cleanup_user_sessions(username):
            return None
        
        session_id = str(uuid.uuid4())
        expire_time = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
        
        # 如果用户不存在，创建用户条目
        if username not in self.active_sessions:
            self.active_sessions[username] = {'sessions': {}}
        
        # 初始化会话数据
        session_data = {
            "expire_time": expire_time,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()  # 记录最后活动时间
        }
        
        # 添加额外的会话属性
        if session_attributes:
            session_data.update(session_attributes)
        
        # 添加会话
        self.active_sessions[username]['sessions'][session_id] = session_data
        
        self._save_sessions()
        logger.info(f"为用户 {username} 创建新会话: {session_id}")
        return session_id

    def end_session(self, session_id: str, reason: str = None) -> bool:
        """结束会话

        参数:
            session_id: 会话ID
            reason: 结束原因（例如：'hijacked', 'expired', 'user_logout'）

        返回:
            是否成功结束
        """
        # 查找会话属于哪个用户
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                # 删除会话
                del user_data['sessions'][session_id]
                
                # 如果用户没有会话了，删除用户
                if not user_data['sessions']:
                    del self.active_sessions[username]
                
                self._save_sessions()
                reason_str = f"，原因: {reason}" if reason else ""
                logger.info(f"结束用户 {username} 的会话: {session_id}{reason_str}")
                return True
        
        logger.warning(f"尝试结束不存在的会话: {session_id}")
        return False

    def validate_session(self, session_id: str, client_info: Dict = None) -> Dict:
        """验证会话有效性并延长有效期，同时检测会话劫持

        参数:
            session_id: 会话ID
            client_info: 客户端信息，包含浏览器指纹、IP、用户代理等

        返回:
            包含验证结果和劫持检测结果的字典
        """
        self._cleanup_expired_sessions()
        
        # 查找会话
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                # 延长会话有效期
                session["expire_time"] = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
                
                # 检测会话劫持
                hijacked = False
                if client_info:
                    hijacked = not self._verify_client_info(session, client_info)
                    
                self._save_sessions()
                logger.debug(f"会话 {session_id} 验证有效，已延长有效期")
                return {
                    "valid": True,
                    "username": username,
                    "expire_time": session["expire_time"],
                    "hijacked": hijacked
                }
        
        logger.warning(f"无效的会话ID: {session_id}")
        return {"valid": False, "hijacked": False}

    def _verify_client_info(self, session: Dict, client_info: Dict) -> bool:
        """验证客户端信息是否匹配

        参数:
            session: 会话数据
            client_info: 客户端信息

        返回:
            是否匹配
        """
        # 检查IP地址（允许同一网络段内的变化）
        if 'ip' in session and 'ip' in client_info:
            session_ip = session['ip']
            client_ip = client_info['ip']
            # 简单的IP匹配（实际应用中可能需要更复杂的网络段检查）
            if session_ip != client_ip:
                logger.warning(f"会话 {session.get('session_id')} IP不匹配: {session_ip} vs {client_ip}")
                return False
        
        # 检查用户代理（允许小版本变化）
        if 'user_agent' in session and 'user_agent' in client_info:
            session_ua = session['user_agent'].lower()
            client_ua = client_info['user_agent'].lower()
            # 检查主要浏览器和操作系统信息是否匹配
            if not (session_ua and client_ua and \
                   (session_ua in client_ua or client_ua in session_ua)):
                logger.warning(f"会话 {session.get('session_id')} 用户代理不匹配")
                return False
        
        # 检查设备类型
        if 'device_type' in session and 'device_type' in client_info:
            if session['device_type'] != client_info['device_type']:
                logger.warning(f"会话 {session.get('session_id')} 设备类型不匹配")
                return False
        
        return True

    def detect_session_hijacking(self, session_id: str, client_info: Dict) -> Dict:
        """检测会话是否被劫持

        参数:
            session_id: 会话ID
            client_info: 客户端信息

        返回:
            包含劫持检测结果和风险评分的字典
        """
        # 查找会话
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                
                # 初始化风险评分
                risk_score = 0
                
                # 验证客户端信息
                is_client_match = self._verify_client_info(session, client_info)
                if not is_client_match:
                    risk_score += 70
                    
                # 检查会话活动模式（例如，短时间内异地登录）
                # 这里可以添加更复杂的检测逻辑
                
                # 确定是否被劫持
                is_hijacked = risk_score >= 70
                
                # 记录劫持检测结果
                if is_hijacked:
                    logger.warning(f"检测到会话劫持: {session_id}，用户: {username}")
                    # 在实际应用中，可能需要触发警报或自动结束会话
                
                return {
                    "hijacked": is_hijacked,
                    "risk_score": risk_score,
                    "session_id": session_id,
                    "username": username
                }
        
        logger.warning(f"尝试检测不存在的会话: {session_id}")
        return {"hijacked": False, "risk_score": 0}
    
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

    def get_session_device_type(self, session_id: str) -> Dict:
        """根据会话ID获取设备类型信息

        参数:
            session_id: 会话ID

        返回:
            包含设备类型信息的字典，如果会话不存在则返回空字典
        """
        self._cleanup_expired_sessions()
        
        # 查找会话
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                device_info = {
                    'device_type': session.get('device_type', 'unknown'),
                    'browser': session.get('browser', 'unknown'),
                    'user_agent': session.get('user_agent', 'unknown'),
                    'ip': session.get('ip', 'unknown')
                }
                logger.debug(f"获取会话 {session_id} 的设备类型信息: {device_info}")
                return device_info
        
        logger.warning(f"尝试获取不存在的会话的设备类型信息: {session_id}")
        return {}