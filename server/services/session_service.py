import os
import json
import uuid
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from threading import Lock, Timer
import aiofiles

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("session_service")

class OptimizedSessionService:
    def __init__(self, session_file: str, session_expire_minutes: int):
        self.session_file = session_file
        self.session_expire_minutes = session_expire_minutes
        self.max_sessions_per_user = 5  # 每个用户最大会话数
        self.inactivity_threshold_minutes = 15  # 非活跃会话阈值(分钟)
        
        # 性能优化相关配置
        self.save_delay_seconds = 5  # 延迟保存时间（秒）
        self.batch_save_threshold = 10  # 批量保存阈值
        self.cleanup_interval_minutes = 10  # 清理间隔（分钟）
        
        # 内存数据结构
        self.active_sessions: Dict[str, Dict] = {}
        self._pending_changes = 0  # 待保存的更改数量
        self._save_timer: Optional[Timer] = None
        self._lock = Lock()  # 线程安全锁
        self._last_cleanup = datetime.utcnow()
        self._dirty = False  # 标记数据是否需要保存
        
        # 初始化
        self._initialize_sessions()
        
        # 启动定期清理任务
        self._start_cleanup_timer()

    def _initialize_sessions(self):
        """初始化会话服务，加载现有会话并清理过期会话"""
        self._load_sessions()
        self._cleanup_expired_sessions()
        self._force_save_sessions()  # 初始化时强制保存一次
        logger.info(f"会话服务初始化完成，当前活跃会话数: {self._get_total_session_count()}")

    def _load_sessions(self):
        """从文件加载会话数据"""
        if os.path.exists(self.session_file):
            try:
                with open(self.session_file, 'r', encoding='utf-8') as f:
                    sessions_data = json.load(f)
                    self.active_sessions = {}
                    for username, user_data in sessions_data.items():
                        if 'sessions' not in user_data:
                            continue
                        self.active_sessions[username] = {'sessions': {}}
                        for session_id, session in user_data['sessions'].items():
                            try:
                                # 确保时间字段是datetime对象
                                self._convert_str_to_datetime(session)
                                self.active_sessions[username]['sessions'][session_id] = session
                            except (ValueError, KeyError) as e:
                                logger.warning(f"用户 {username} 的无效会话数据 {session_id}: {e}")
            except json.JSONDecodeError as e:
                logger.error(f"会话文件格式错误: {e}")
                self.active_sessions = {}
        else:
            logger.info(f"会话文件 {self.session_file} 不存在，将创建新文件")
            self.active_sessions = {}

    def _convert_str_to_datetime(self, session: Dict):
        """将字符串时间转换为datetime对象"""
        time_fields = ['expire_time', 'created_at', 'last_activity']
        for field in time_fields:
            if field in session and isinstance(session[field], str):
                session[field] = datetime.fromisoformat(session[field])

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

    def _mark_dirty(self):
        """标记数据需要保存"""
        with self._lock:
            self._dirty = True
            self._pending_changes += 1
            
            # 如果达到批量保存阈值，立即保存
            if self._pending_changes >= self.batch_save_threshold:
                self._schedule_immediate_save()
            else:
                self._schedule_delayed_save()

    def _schedule_delayed_save(self):
        """调度延迟保存"""
        if self._save_timer is not None:
            self._save_timer.cancel()
        
        self._save_timer = Timer(self.save_delay_seconds, self._delayed_save)
        self._save_timer.start()

    def _schedule_immediate_save(self):
        """调度立即保存"""
        if self._save_timer is not None:
            self._save_timer.cancel()
            self._save_timer = None
        
        # 在新线程中执行保存，避免阻塞主线程
        Timer(0.1, self._delayed_save).start()

    def _delayed_save(self):
        """延迟保存回调"""
        try:
            self._save_sessions()
        except Exception as e:
            logger.error(f"延迟保存失败: {e}")
        finally:
            with self._lock:
                self._save_timer = None

    def _save_sessions(self):
        """将会话数据保存到文件（优化版本）"""
        with self._lock:
            if not self._dirty:
                return
            
            try:
                # 确保目录存在
                os.makedirs(os.path.dirname(self.session_file), exist_ok=True)
                
                # 使用递归方法转换所有datetime对象
                sessions_data = self._convert_datetime_to_str(self.active_sessions.copy())
                
                # 写入临时文件，然后原子性重命名
                temp_file = self.session_file + '.tmp'
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(sessions_data, f, indent=2, ensure_ascii=False)
                
                # 原子性重命名
                if os.path.exists(self.session_file):
                    os.replace(temp_file, self.session_file)
                else:
                    os.rename(temp_file, self.session_file)
                
                self._dirty = False
                self._pending_changes = 0
                logger.debug(f"成功保存 {len(sessions_data)} 个用户的会话到文件")
                
            except Exception as e:
                logger.error(f"保存会话失败: {e}")
                # 清理临时文件
                temp_file = self.session_file + '.tmp'
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except:
                        pass

    def _force_save_sessions(self):
        """强制立即保存会话数据"""
        with self._lock:
            self._dirty = True
        self._save_sessions()

    async def _async_save_sessions(self):
        """异步保存会话数据"""
        with self._lock:
            if not self._dirty:
                return
            
            sessions_data = self._convert_datetime_to_str(self.active_sessions.copy())
            self._dirty = False
            self._pending_changes = 0
        
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.session_file), exist_ok=True)
            
            # 异步写入文件
            temp_file = self.session_file + '.tmp'
            async with aiofiles.open(temp_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(sessions_data, indent=2, ensure_ascii=False))
            
            # 原子性重命名
            if os.path.exists(self.session_file):
                os.replace(temp_file, self.session_file)
            else:
                os.rename(temp_file, self.session_file)
            
            logger.debug(f"异步保存 {len(sessions_data)} 个用户的会话到文件")
            
        except Exception as e:
            logger.error(f"异步保存会话失败: {e}")
            # 清理临时文件
            temp_file = self.session_file + '.tmp'
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass

    def _should_cleanup(self) -> bool:
        """判断是否需要执行清理"""
        return (datetime.utcnow() - self._last_cleanup).total_seconds() > (self.cleanup_interval_minutes * 60)

    def _cleanup_expired_sessions(self) -> bool:
        """清理过期会话（优化版本）"""
        if not self._should_cleanup():
            return False
        
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
            self._mark_dirty()
        
        self._last_cleanup = current_time
        return cleaned_up

    def _start_cleanup_timer(self):
        """启动定期清理定时器"""
        def cleanup_task():
            try:
                self._cleanup_expired_sessions()
            except Exception as e:
                logger.error(f"定期清理任务失败: {e}")
            finally:
                # 重新调度下一次清理
                Timer(self.cleanup_interval_minutes * 60, cleanup_task).start()
        
        Timer(self.cleanup_interval_minutes * 60, cleanup_task).start()

    def _get_total_session_count(self) -> int:
        """获取总会话数（内存操作，不触发清理）"""
        count = 0
        for user_data in self.active_sessions.values():
            if 'sessions' in user_data:
                count += len(user_data['sessions'])
        return count

    def _is_session_active(self, session: Dict) -> bool:
        """判断会话是否活跃"""
        if 'last_activity' not in session:
            return True
        
        inactivity_minutes = (datetime.utcnow() - session['last_activity']).total_seconds() / 60
        return inactivity_minutes < self.inactivity_threshold_minutes

    def _get_least_active_session(self, username: str) -> Optional[str]:
        """获取用户最不活跃的会话ID"""
        if username not in self.active_sessions or 'sessions' not in self.active_sessions[username]:
            return None
        
        user_sessions = self.active_sessions[username]['sessions']
        sorted_sessions = sorted(
            user_sessions.items(),
            key=lambda x: x[1].get('last_activity', x[1]['created_at'])
        )
        
        for session_id, session in sorted_sessions:
            if not self._is_session_active(session):
                return session_id
        
        return None

    def _check_and_cleanup_user_sessions(self, username: str) -> bool:
        """检查用户会话数，清理非活跃会话"""
        if username not in self.active_sessions or 'sessions' not in self.active_sessions[username]:
            return True
        
        user_sessions = self.active_sessions[username]['sessions']
        
        if len(user_sessions) < self.max_sessions_per_user:
            return True
        
        least_active_session_id = self._get_least_active_session(username)
        if least_active_session_id:
            self.end_session(least_active_session_id)
            return True
        
        logger.warning(f"用户 {username} 已达到最大活跃会话数 {self.max_sessions_per_user}")
        return False

    def create_session(self, username: str, session_attributes: Dict = None) -> Optional[str]:
        """创建新会话并返回会话ID（优化版本）"""
        if not self._check_and_cleanup_user_sessions(username):
            return None
        
        session_id = str(uuid.uuid4())
        expire_time = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
        
        if username not in self.active_sessions:
            self.active_sessions[username] = {'sessions': {}}
        
        session_data = {
            "expire_time": expire_time,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        
        if session_attributes:
            session_data.update(session_attributes)
        
        self.active_sessions[username]['sessions'][session_id] = session_data
        
        # 标记需要保存，但不立即保存
        self._mark_dirty()
        logger.info(f"为用户 {username} 创建新会话: {session_id}")
        return session_id

    def end_session(self, session_id: str, reason: str = None) -> bool:
        """结束会话（优化版本）"""
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                del user_data['sessions'][session_id]
                
                if not user_data['sessions']:
                    del self.active_sessions[username]
                
                # 标记需要保存
                self._mark_dirty()
                reason_str = f"，原因: {reason}" if reason else ""
                logger.info(f"结束用户 {username} 的会话: {session_id}{reason_str}")
                return True
        
        logger.warning(f"尝试结束不存在的会话: {session_id}")
        return False

    def validate_session(self, session_id: str, client_info: Dict = None) -> Dict:
        """验证会话有效性并延长有效期（优化版本）"""
        # 只在必要时清理过期会话
        self._cleanup_expired_sessions()
        
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                
                # 延长会话有效期
                session["expire_time"] = datetime.utcnow() + timedelta(minutes=self.session_expire_minutes)
                session["last_activity"] = datetime.utcnow()
                
                # 检测会话劫持
                hijacked = False
                if client_info:
                    hijacked = not self._verify_client_info(session, client_info)
                
                # 标记需要保存
                self._mark_dirty()
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
        """验证客户端信息是否匹配"""
        # 检查IP地址
        if 'ip' in session and 'ip' in client_info:
            if session['ip'] != client_info['ip']:
                logger.warning(f"会话IP不匹配: {session['ip']} vs {client_info['ip']}")
                return False
        
        # 检查用户代理
        if 'user_agent' in session and 'user_agent' in client_info:
            session_ua = session['user_agent'].lower()
            client_ua = client_info['user_agent'].lower()
            if not (session_ua and client_ua and (session_ua in client_ua or client_ua in session_ua)):
                logger.warning("会话用户代理不匹配")
                return False
        
        # 检查设备类型
        if 'device_type' in session and 'device_type' in client_info:
            if session['device_type'] != client_info['device_type']:
                logger.warning("会话设备类型不匹配")
                return False
        
        return True

    def detect_session_hijacking(self, session_id: str, client_info: Dict) -> Dict:
        """检测会话是否被劫持"""
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                
                risk_score = 0
                is_client_match = self._verify_client_info(session, client_info)
                if not is_client_match:
                    risk_score += 70
                
                is_hijacked = risk_score >= 70
                
                if is_hijacked:
                    logger.warning(f"检测到会话劫持: {session_id}，用户: {username}")
                
                return {
                    "hijacked": is_hijacked,
                    "risk_score": risk_score,
                    "session_id": session_id,
                    "username": username
                }
        
        logger.warning(f"尝试检测不存在的会话: {session_id}")
        return {"hijacked": False, "risk_score": 0}

    def update_session_activity(self, session_id: str) -> bool:
        """更新会话的最后活动时间（优化版本）"""
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id]
                session["last_activity"] = datetime.utcnow()
                
                # 标记需要保存，但不立即保存
                self._mark_dirty()
                logger.debug(f"更新会话 {session_id} 的最后活动时间")
                return True
        
        logger.warning(f"尝试更新不存在的会话: {session_id}")
        return False

    def get_active_session_count(self) -> int:
        """获取当前活跃会话数量"""
        self._cleanup_expired_sessions()
        return self._get_total_session_count()

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
        self._force_save_sessions()
        logger.info("已清除所有会话")

    def get_session(self, session_id: str) -> Optional[Dict]:
        """根据会话ID获取会话信息"""
        self._cleanup_expired_sessions()
        
        for username, user_data in self.active_sessions.items():
            if 'sessions' in user_data and session_id in user_data['sessions']:
                session = user_data['sessions'][session_id].copy()
                session['username'] = username
                session['session_id'] = session_id
                logger.debug(f"获取会话 {session_id} 的信息")
                return session
        
        logger.warning(f"尝试获取不存在的会话: {session_id}")
        return None

    def get_session_device_type(self, session_id: str) -> Dict:
        """根据会话ID获取设备类型信息"""
        self._cleanup_expired_sessions()
        
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

    def force_save(self):
        """强制保存所有待保存的数据"""
        if self._save_timer is not None:
            self._save_timer.cancel()
            self._save_timer = None
        self._force_save_sessions()

    async def async_force_save(self):
        """异步强制保存所有待保存的数据"""
        if self._save_timer is not None:
            self._save_timer.cancel()
            self._save_timer = None
        await self._async_save_sessions()

    def shutdown(self):
        """关闭会话服务，保存所有数据"""
        logger.info("正在关闭会话服务...")
        self.force_save()
        logger.info("会话服务已关闭")

# 为了向后兼容，保留原始类名的别名
SessionService = OptimizedSessionService