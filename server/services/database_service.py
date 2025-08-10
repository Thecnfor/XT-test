import asyncio
import bcrypt
import os
import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from schemas.user import User
from config import (
    DATABASE_TYPE, DATABASE_USER, DATABASE_PASSWORD, 
    DATABASE_HOST_PORT, DATABASE_NAME, DATABASE_MAX_RETRIES, 
    BCRYPT_WORK_FACTOR
)
from services.cache_service import get_cache_service, cache_result

# 设置日志
logger = logging.getLogger(__name__)

# 数据库文件路径
DB_FILE = "server/db/users.db"

# 确保数据库目录存在
os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)

class DatabaseConnectionPool:
    """数据库连接池管理器"""
    
    def __init__(self, max_connections: int = 10):
        self.max_connections = max_connections
        self._pool = asyncio.Queue(maxsize=max_connections)
        self._created_connections = 0
        self._lock = asyncio.Lock()
        
    async def _create_connection(self):
        """创建新的数据库连接"""
        if DATABASE_TYPE == "mysql":
            import aiomysql
            conn = await aiomysql.connect(
                host=DATABASE_HOST_PORT.split(':')[0],
                port=int(DATABASE_HOST_PORT.split(':')[1]),
                user=DATABASE_USER,
                password=DATABASE_PASSWORD,
                db=DATABASE_NAME,
                cursorclass=aiomysql.DictCursor,
                autocommit=False
            )
            return conn
        else:
            import aiosqlite
            conn = await aiosqlite.connect(
                DB_FILE,
                timeout=30,
                isolation_level=None  # 自动提交模式
            )
            conn.row_factory = aiosqlite.Row
            return conn
    
    async def get_connection(self):
        """从连接池获取连接"""
        try:
            # 尝试从池中获取现有连接
            conn = self._pool.get_nowait()
            return conn
        except asyncio.QueueEmpty:
            # 池为空，创建新连接
            async with self._lock:
                if self._created_connections < self.max_connections:
                    conn = await self._create_connection()
                    self._created_connections += 1
                    logger.debug(f"创建新数据库连接，当前连接数: {self._created_connections}")
                    return conn
                else:
                    # 等待连接可用
                    conn = await self._pool.get()
                    return conn
    
    async def return_connection(self, conn):
        """将连接返回到池中"""
        try:
            await self._pool.put(conn)
        except asyncio.QueueFull:
            # 池已满，关闭连接
            await conn.close()
            async with self._lock:
                self._created_connections -= 1
    
    async def close_all(self):
        """关闭所有连接"""
        while not self._pool.empty():
            try:
                conn = self._pool.get_nowait()
                await conn.close()
            except asyncio.QueueEmpty:
                break
        self._created_connections = 0

# 全局连接池实例
_connection_pool: Optional[DatabaseConnectionPool] = None

def get_connection_pool() -> DatabaseConnectionPool:
    """获取连接池实例"""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = DatabaseConnectionPool()
    return _connection_pool

@asynccontextmanager
async def get_db_connection():
    """异步上下文管理器，自动管理数据库连接"""
    pool = get_connection_pool()
    conn = await pool.get_connection()
    try:
        yield conn
    except Exception as e:
        # 发生错误时回滚事务
        if DATABASE_TYPE == "mysql":
            await conn.rollback()
        logger.error(f"数据库操作错误: {e}")
        raise
    finally:
        await pool.return_connection(conn)

class DatabaseService:
    """数据库服务类，提供安全的数据库操作"""
    
    @staticmethod
    async def init_db():
        """初始化数据库表"""
        async with get_db_connection() as conn:
            if DATABASE_TYPE == "mysql":
                cursor = await conn.cursor()
                await cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username)
                )
                ''')
                await cursor.close()
                await conn.commit()
            else:
                cursor = await conn.cursor()
                await cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                ''')
                await cursor.execute('CREATE INDEX IF NOT EXISTS idx_username ON users(username)')
                await cursor.close()
        
        logger.info("数据库初始化完成")
    
    @staticmethod
    async def add_user(username: str, password: str) -> bool:
        """安全地添加新用户"""
        # 输入验证
        if not username or not password:
            logger.warning("用户名或密码为空")
            return False
        
        if len(username) > 50:
            logger.warning("用户名过长")
            return False
        
        # 密码强度验证可以在这里添加
        
        max_retries = DATABASE_MAX_RETRIES
        for attempt in range(max_retries):
            try:
                # 加密密码
                hashed_password = bcrypt.hashpw(
                    password.encode('utf-8'), 
                    bcrypt.gensalt(BCRYPT_WORK_FACTOR)
                )
                
                async with get_db_connection() as conn:
                    cursor = await conn.cursor()
                    
                    # 使用参数化查询防止SQL注入
                    if DATABASE_TYPE == "mysql":
                        await cursor.execute(
                            "INSERT INTO users (username, password) VALUES (%s, %s)",
                            (username, hashed_password.decode('utf-8'))
                        )
                        await conn.commit()
                    else:
                        await cursor.execute(
                            "INSERT INTO users (username, password) VALUES (?, ?)",
                            (username, hashed_password.decode('utf-8'))
                        )
                    
                    await cursor.close()
                    logger.info(f"用户 {username} 添加成功")
                    
                    # 清理用户计数缓存
                    cache_service = get_cache_service()
                    try:
                        await cache_service.delete("user_count")
                        logger.debug("用户计数缓存已清理")
                    except Exception as e:
                        logger.warning(f"缓存清理失败: {e}")
                    
                    return True
                    
            except Exception as e:
                error_msg = str(e).lower()
                if 'unique' in error_msg or 'duplicate' in error_msg:
                    logger.warning(f"用户名 {username} 已存在")
                    return False
                elif 'database is locked' in error_msg and attempt < max_retries - 1:
                    logger.warning(f"数据库锁定，重试 {attempt + 1}/{max_retries}")
                    await asyncio.sleep(0.5 * (attempt + 1))  # 指数退避
                    continue
                else:
                    logger.error(f"添加用户失败: {e}")
                    return False
        
        logger.error(f"添加用户 {username} 失败，已达到最大重试次数")
        return False
    
    @staticmethod
    async def verify_user(username: str, password: str) -> bool:
        """安全地验证用户凭据（带缓存）"""
        if not username or not password:
            return False
        
        # 首先尝试从缓存获取用户信息
        user = await DatabaseService.get_user(username)
        if not user:
            logger.warning(f"用户 {username} 不存在")
            return False
        
        try:
            # 验证密码
            is_valid = bcrypt.checkpw(
                password.encode('utf-8'), 
                user.password.encode('utf-8')
            )
            
            if is_valid:
                logger.info(f"用户 {username} 验证成功")
                
                # 缓存验证结果（短时间缓存，5分钟）
                cache_service = get_cache_service()
                auth_cache_key = cache_service.generate_cache_key("auth_success", username, password[:10])  # 只用密码前10位作为键的一部分
                try:
                    await cache_service.set(auth_cache_key, True, 300)
                except Exception as e:
                    logger.warning(f"认证缓存设置失败: {e}")
            else:
                logger.warning(f"用户 {username} 密码验证失败")
            
            return is_valid
                    
        except Exception as e:
            logger.error(f"验证用户失败: {e}")
            return False
    
    @staticmethod
    async def get_user(username: str) -> Optional[User]:
        """安全地获取用户信息（带缓存）"""
        if not username:
            return None
        
        # 尝试从缓存获取
        cache_service = get_cache_service()
        cache_key = cache_service.generate_cache_key("user", username)
        
        try:
            cached_user = await cache_service.get(cache_key)
            if cached_user:
                logger.debug(f"用户信息缓存命中: {username}")
                return User(**cached_user)
        except Exception as e:
            logger.warning(f"缓存获取失败: {e}")
        
        try:
            async with get_db_connection() as conn:
                cursor = await conn.cursor()
                
                # 使用参数化查询防止SQL注入
                if DATABASE_TYPE == "mysql":
                    await cursor.execute(
                        "SELECT id, username, password FROM users WHERE username = %s",
                        (username,)
                    )
                else:
                    await cursor.execute(
                        "SELECT id, username, password FROM users WHERE username = ?",
                        (username,)
                    )
                
                result = await cursor.fetchone()
                await cursor.close()
                
                if result:
                    if DATABASE_TYPE == "mysql":
                        user = User(
                            id=result['id'],
                            username=result['username'],
                            password=result['password']
                        )
                    else:
                        user = User(
                            id=result[0],
                            username=result[1],
                            password=result[2]
                        )
                    
                    # 缓存用户信息（15分钟）
                    try:
                        await cache_service.set(cache_key, user.dict(), 900)
                        logger.debug(f"用户信息已缓存: {username}")
                    except Exception as e:
                        logger.warning(f"缓存设置失败: {e}")
                    
                    return user
                return None
                
        except Exception as e:
            logger.error(f"获取用户信息失败: {e}")
            return None
    
    @staticmethod
    async def update_user_password(username: str, new_password: str) -> bool:
        """安全地更新用户密码（清理相关缓存）"""
        if not username or not new_password:
            return False
        
        try:
            # 加密新密码
            hashed_password = bcrypt.hashpw(
                new_password.encode('utf-8'), 
                bcrypt.gensalt(BCRYPT_WORK_FACTOR)
            )
            
            async with get_db_connection() as conn:
                cursor = await conn.cursor()
                
                # 使用参数化查询防止SQL注入
                if DATABASE_TYPE == "mysql":
                    await cursor.execute(
                        "UPDATE users SET password = %s, updated_at = CURRENT_TIMESTAMP WHERE username = %s",
                        (hashed_password.decode('utf-8'), username)
                    )
                    await conn.commit()
                else:
                    await cursor.execute(
                        "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
                        (hashed_password.decode('utf-8'), username)
                    )
                
                affected_rows = cursor.rowcount
                await cursor.close()
                
                if affected_rows > 0:
                    logger.info(f"用户 {username} 密码更新成功")
                    
                    # 清理相关缓存
                    cache_service = get_cache_service()
                    try:
                        # 清理用户信息缓存
                        user_cache_key = cache_service.generate_cache_key("user", username)
                        await cache_service.delete(user_cache_key)
                        
                        # 清理认证缓存（模式匹配）
                        auth_keys = await cache_service.keys(f"auth_success:{username}:*")
                        for key in auth_keys:
                            await cache_service.delete(key)
                        
                        logger.debug(f"已清理用户 {username} 的相关缓存")
                    except Exception as e:
                        logger.warning(f"清理缓存失败: {e}")
                    
                    return True
                else:
                    logger.warning(f"用户 {username} 不存在，无法更新密码")
                    return False
                    
        except Exception as e:
            logger.error(f"更新用户密码失败: {e}")
            return False
    
    @staticmethod
    async def delete_user(username: str) -> bool:
        """安全地删除用户（清理相关缓存）"""
        if not username:
            return False
        
        try:
            async with get_db_connection() as conn:
                cursor = await conn.cursor()
                
                # 使用参数化查询防止SQL注入
                if DATABASE_TYPE == "mysql":
                    await cursor.execute(
                        "DELETE FROM users WHERE username = %s",
                        (username,)
                    )
                    await conn.commit()
                else:
                    await cursor.execute(
                        "DELETE FROM users WHERE username = ?",
                        (username,)
                    )
                
                affected_rows = cursor.rowcount
                await cursor.close()
                
                if affected_rows > 0:
                    logger.info(f"用户 {username} 删除成功")
                    
                    # 清理相关缓存
                    cache_service = get_cache_service()
                    try:
                        # 清理用户信息缓存
                        user_cache_key = cache_service.generate_cache_key("user", username)
                        await cache_service.delete(user_cache_key)
                        
                        # 清理认证缓存
                        auth_keys = await cache_service.keys(f"auth_success:{username}:*")
                        for key in auth_keys:
                            await cache_service.delete(key)
                        
                        # 清理用户计数缓存
                        await cache_service.delete("user_count")
                        
                        logger.debug(f"已清理用户 {username} 的相关缓存")
                    except Exception as e:
                        logger.warning(f"清理缓存失败: {e}")
                    
                    return True
                else:
                    logger.warning(f"用户 {username} 不存在，无法删除")
                    return False
                    
        except Exception as e:
            logger.error(f"删除用户失败: {e}")
            return False
    
    @staticmethod
    async def get_user_count() -> int:
        """获取用户总数（带缓存）"""
        # 尝试从缓存获取
        cache_service = get_cache_service()
        cache_key = "user_count"
        
        try:
            cached_count = await cache_service.get(cache_key)
            if cached_count is not None:
                logger.debug("用户计数缓存命中")
                return cached_count
        except Exception as e:
            logger.warning(f"缓存获取失败: {e}")
        
        try:
            async with get_db_connection() as conn:
                cursor = await conn.cursor()
                
                await cursor.execute("SELECT COUNT(*) as count FROM users")
                result = await cursor.fetchone()
                await cursor.close()
                
                count = result['count'] if DATABASE_TYPE == "mysql" else result[0]
                
                # 缓存用户计数（10分钟）
                try:
                    await cache_service.set(cache_key, count, 600)
                    logger.debug(f"用户计数已缓存: {count}")
                except Exception as e:
                    logger.warning(f"缓存设置失败: {e}")
                
                return count
                
        except Exception as e:
            logger.error(f"获取用户数量失败: {e}")
            return 0

# 创建数据库服务实例
db_service = DatabaseService()

# 兼容性函数，保持向后兼容
async def add_user(username: str, password: str) -> bool:
    """向后兼容的添加用户函数"""
    return await db_service.add_user(username, password)

async def verify_user(username: str, password: str) -> bool:
    """向后兼容的验证用户函数"""
    return await db_service.verify_user(username, password)

async def get_user(username: str) -> Optional[User]:
    """向后兼容的获取用户函数"""
    return await db_service.get_user(username)

# 初始化数据库
async def init_database():
    """初始化数据库"""
    await db_service.init_db()

# 在模块加载时初始化数据库
if __name__ == "__main__":
    asyncio.run(init_database())
else:
    # 在导入时异步初始化
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # 如果事件循环正在运行，创建任务
            asyncio.create_task(init_database())
        else:
            # 如果事件循环未运行，直接运行
            loop.run_until_complete(init_database())
    except RuntimeError:
        # 如果没有事件循环，创建新的
        asyncio.run(init_database())