import asyncio
import json
import logging
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta
import hashlib
from contextlib import asynccontextmanager

# 设置日志
logger = logging.getLogger(__name__)

class MemoryCache:
    """内存缓存实现，用于本地缓存"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._access_times: Dict[str, datetime] = {}
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        async with self._lock:
            if key not in self._cache:
                return None
            
            cache_item = self._cache[key]
            
            # 检查是否过期
            if cache_item['expires_at'] and datetime.now() > cache_item['expires_at']:
                await self._remove_key(key)
                return None
            
            # 更新访问时间
            self._access_times[key] = datetime.now()
            return cache_item['value']
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """设置缓存值"""
        async with self._lock:
            # 如果缓存已满，清理最久未访问的项
            if len(self._cache) >= self.max_size and key not in self._cache:
                await self._evict_lru()
            
            expires_at = None
            if ttl is not None:
                expires_at = datetime.now() + timedelta(seconds=ttl)
            elif self.default_ttl > 0:
                expires_at = datetime.now() + timedelta(seconds=self.default_ttl)
            
            self._cache[key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': datetime.now()
            }
            self._access_times[key] = datetime.now()
            
            logger.debug(f"缓存设置成功: {key}")
            return True
    
    async def delete(self, key: str) -> bool:
        """删除缓存项"""
        async with self._lock:
            return await self._remove_key(key)
    
    async def clear(self) -> bool:
        """清空所有缓存"""
        async with self._lock:
            self._cache.clear()
            self._access_times.clear()
            logger.info("内存缓存已清空")
            return True
    
    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        return await self.get(key) is not None
    
    async def keys(self, pattern: str = "*") -> List[str]:
        """获取所有键（简单模式匹配）"""
        async with self._lock:
            if pattern == "*":
                return list(self._cache.keys())
            
            # 简单的通配符匹配
            import fnmatch
            return [key for key in self._cache.keys() if fnmatch.fnmatch(key, pattern)]
    
    async def _remove_key(self, key: str) -> bool:
        """内部方法：移除键"""
        if key in self._cache:
            del self._cache[key]
            if key in self._access_times:
                del self._access_times[key]
            return True
        return False
    
    async def _evict_lru(self):
        """清理最久未访问的项"""
        if not self._access_times:
            return
        
        # 找到最久未访问的键
        oldest_key = min(self._access_times.keys(), key=lambda k: self._access_times[k])
        await self._remove_key(oldest_key)
        logger.debug(f"LRU清理: {oldest_key}")
    
    async def cleanup_expired(self):
        """清理过期的缓存项"""
        async with self._lock:
            now = datetime.now()
            expired_keys = []
            
            for key, cache_item in self._cache.items():
                if cache_item['expires_at'] and now > cache_item['expires_at']:
                    expired_keys.append(key)
            
            for key in expired_keys:
                await self._remove_key(key)
            
            if expired_keys:
                logger.info(f"清理了 {len(expired_keys)} 个过期缓存项")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        return {
            'total_items': len(self._cache),
            'max_size': self.max_size,
            'default_ttl': self.default_ttl,
            'memory_usage_estimate': len(str(self._cache))  # 简单估算
        }

class CacheService:
    """缓存服务类，提供统一的缓存接口"""
    
    def __init__(self, use_redis: bool = False, redis_url: str = "redis://localhost:6379"):
        self.use_redis = use_redis
        self.redis_url = redis_url
        self._redis_client = None
        self._memory_cache = MemoryCache()
        self._cleanup_task = None
        
    async def initialize(self):
        """初始化缓存服务"""
        if self.use_redis:
            try:
                import aioredis
                self._redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
                # 测试连接
                await self._redis_client.ping()
                logger.info("Redis缓存已连接")
            except ImportError:
                logger.warning("aioredis未安装，使用内存缓存")
                self.use_redis = False
            except Exception as e:
                logger.warning(f"Redis连接失败，使用内存缓存: {e}")
                self.use_redis = False
        
        if not self.use_redis:
            logger.info("使用内存缓存")
            # 启动清理任务
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
    
    async def close(self):
        """关闭缓存服务"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        if self._redis_client:
            await self._redis_client.close()
    
    async def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        try:
            if self.use_redis and self._redis_client:
                value = await self._redis_client.get(key)
                if value is not None:
                    return json.loads(value)
                return None
            else:
                return await self._memory_cache.get(key)
        except Exception as e:
            logger.error(f"缓存获取失败 {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """设置缓存值"""
        try:
            if self.use_redis and self._redis_client:
                serialized_value = json.dumps(value, ensure_ascii=False)
                if ttl is not None:
                    await self._redis_client.setex(key, ttl, serialized_value)
                else:
                    await self._redis_client.set(key, serialized_value)
                return True
            else:
                return await self._memory_cache.set(key, value, ttl)
        except Exception as e:
            logger.error(f"缓存设置失败 {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """删除缓存项"""
        try:
            if self.use_redis and self._redis_client:
                result = await self._redis_client.delete(key)
                return result > 0
            else:
                return await self._memory_cache.delete(key)
        except Exception as e:
            logger.error(f"缓存删除失败 {key}: {e}")
            return False
    
    async def clear(self) -> bool:
        """清空所有缓存"""
        try:
            if self.use_redis and self._redis_client:
                await self._redis_client.flushdb()
                return True
            else:
                return await self._memory_cache.clear()
        except Exception as e:
            logger.error(f"缓存清空失败: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        try:
            if self.use_redis and self._redis_client:
                return await self._redis_client.exists(key) > 0
            else:
                return await self._memory_cache.exists(key)
        except Exception as e:
            logger.error(f"缓存存在性检查失败 {key}: {e}")
            return False
    
    async def keys(self, pattern: str = "*") -> List[str]:
        """获取匹配模式的所有键"""
        try:
            if self.use_redis and self._redis_client:
                return await self._redis_client.keys(pattern)
            else:
                return await self._memory_cache.keys(pattern)
        except Exception as e:
            logger.error(f"缓存键列表获取失败: {e}")
            return []
    
    def generate_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """生成缓存键"""
        # 创建一个包含所有参数的字符串
        key_parts = [prefix]
        
        # 添加位置参数
        for arg in args:
            key_parts.append(str(arg))
        
        # 添加关键字参数（按键排序确保一致性）
        for k, v in sorted(kwargs.items()):
            key_parts.append(f"{k}:{v}")
        
        # 生成键
        key_string = ":".join(key_parts)
        
        # 如果键太长，使用哈希
        if len(key_string) > 200:
            hash_obj = hashlib.md5(key_string.encode())
            return f"{prefix}:hash:{hash_obj.hexdigest()}"
        
        return key_string
    
    async def get_or_set(self, key: str, factory_func, ttl: Optional[int] = None) -> Any:
        """获取缓存值，如果不存在则调用工厂函数设置"""
        # 先尝试获取
        value = await self.get(key)
        if value is not None:
            return value
        
        # 不存在，调用工厂函数
        try:
            if asyncio.iscoroutinefunction(factory_func):
                value = await factory_func()
            else:
                value = factory_func()
            
            # 设置缓存
            await self.set(key, value, ttl)
            return value
        except Exception as e:
            logger.error(f"工厂函数执行失败 {key}: {e}")
            raise
    
    async def _periodic_cleanup(self):
        """定期清理过期缓存（仅内存缓存）"""
        while True:
            try:
                await asyncio.sleep(300)  # 每5分钟清理一次
                if not self.use_redis:
                    await self._memory_cache.cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"缓存清理任务失败: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        stats = {
            'cache_type': 'redis' if self.use_redis else 'memory',
            'redis_connected': self._redis_client is not None if self.use_redis else False
        }
        
        if not self.use_redis:
            stats.update(self._memory_cache.get_stats())
        
        return stats

# 全局缓存服务实例
_cache_service: Optional[CacheService] = None

def get_cache_service() -> CacheService:
    """获取缓存服务实例"""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service

@asynccontextmanager
async def cache_context():
    """缓存上下文管理器"""
    cache_service = get_cache_service()
    try:
        yield cache_service
    except Exception as e:
        logger.error(f"缓存操作错误: {e}")
        raise

# 缓存装饰器
def cache_result(key_prefix: str, ttl: Optional[int] = None):
    """缓存函数结果的装饰器"""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            cache_service = get_cache_service()
            
            # 生成缓存键
            cache_key = cache_service.generate_cache_key(key_prefix, *args, **kwargs)
            
            # 尝试从缓存获取
            cached_result = await cache_service.get(cache_key)
            if cached_result is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return cached_result
            
            # 执行函数
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # 缓存结果
            await cache_service.set(cache_key, result, ttl)
            logger.debug(f"缓存设置: {cache_key}")
            
            return result
        
        def sync_wrapper(*args, **kwargs):
            # 对于同步函数，需要在事件循环中运行
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

# 初始化缓存服务
async def init_cache_service(use_redis: bool = False, redis_url: str = "redis://localhost:6379"):
    """初始化缓存服务"""
    global _cache_service
    _cache_service = CacheService(use_redis=use_redis, redis_url=redis_url)
    await _cache_service.initialize()
    logger.info("缓存服务初始化完成")

# 关闭缓存服务
async def close_cache_service():
    """关闭缓存服务"""
    global _cache_service
    if _cache_service:
        await _cache_service.close()
        _cache_service = None
        logger.info("缓存服务已关闭")