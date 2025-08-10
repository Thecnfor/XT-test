# 缓存配置示例
# 复制此文件并重命名为 cache_config.py，然后根据需要修改配置

# 是否使用Redis缓存（如果为False，则使用内存缓存）
USE_REDIS_CACHE = False

# Redis连接URL（仅在USE_REDIS_CACHE=True时使用）
# 格式: redis://[:password]@host:port/db
# 示例:
# REDIS_URL = "redis://localhost:6379/0"  # 本地Redis，数据库0
# REDIS_URL = "redis://:password@localhost:6379/0"  # 带密码的Redis
# REDIS_URL = "redis://user:password@redis-server:6379/1"  # 远程Redis服务器
REDIS_URL = "redis://localhost:6379/0"

# 默认缓存过期时间（秒）
DEFAULT_CACHE_TTL = 3600  # 1小时

# 内存缓存最大条目数（仅在USE_REDIS_CACHE=False时使用）
MEMORY_CACHE_MAX_SIZE = 1000

# 缓存键前缀（用于区分不同应用的缓存）
CACHE_KEY_PREFIX = "xt_app"

# 缓存配置说明：
# 1. 开发环境建议使用内存缓存（USE_REDIS_CACHE=False）
# 2. 生产环境建议使用Redis缓存（USE_REDIS_CACHE=True）
# 3. Redis缓存支持集群部署和数据持久化
# 4. 内存缓存仅在单个应用实例内有效