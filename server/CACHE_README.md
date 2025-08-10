# 缓存系统使用说明

## 概述

本项目集成了一个灵活的缓存系统，支持内存缓存和Redis缓存两种模式，用于提高应用性能和减少数据库查询。

## 功能特性

- **双模式支持**: 内存缓存（开发环境）和Redis缓存（生产环境）
- **TTL支持**: 自动过期时间管理
- **LRU淘汰**: 内存缓存支持最近最少使用淘汰策略
- **批量操作**: 支持批量获取、设置和删除
- **模式匹配**: 支持通配符模式的键删除
- **装饰器支持**: 提供函数结果缓存装饰器
- **监控API**: 提供缓存统计和管理接口

## 配置说明

### 环境变量配置

在 `config.py` 中配置以下参数：

```python
# 是否使用Redis缓存
USE_REDIS_CACHE = False  # True: Redis缓存, False: 内存缓存

# Redis连接URL
REDIS_URL = "redis://localhost:6379/0"

# 默认缓存过期时间（秒）
DEFAULT_CACHE_TTL = 3600

# 内存缓存最大条目数
MEMORY_CACHE_MAX_SIZE = 1000
```

### 缓存模式选择

- **内存缓存**: 适用于开发环境和单实例部署
- **Redis缓存**: 适用于生产环境和多实例部署

## 使用方法

### 1. 基本缓存操作

```python
from services.cache_service import get_cache_service

# 获取缓存服务实例
cache_service = get_cache_service()

# 设置缓存
await cache_service.set("key", "value", ttl=300)  # 5分钟过期

# 获取缓存
value = await cache_service.get("key")

# 删除缓存
await cache_service.delete("key")

# 检查键是否存在
exists = await cache_service.exists("key")
```

### 2. 批量操作

```python
# 批量设置
data = {"key1": "value1", "key2": "value2"}
await cache_service.set_many(data, ttl=300)

# 批量获取
keys = ["key1", "key2"]
values = await cache_service.get_many(keys)

# 批量删除
await cache_service.delete_many(keys)
```

### 3. 模式匹配删除

```python
# 删除所有以"user:"开头的键
await cache_service.delete_pattern("user:*")
```

### 4. 函数结果缓存装饰器

```python
from services.cache_service import cache_result

@cache_result(ttl=600, key_prefix="user_data")
async def get_user_data(user_id: int):
    # 这个函数的结果会被自动缓存10分钟
    return await fetch_user_from_database(user_id)
```

## 缓存策略

### 数据库操作缓存

项目中已为以下数据库操作添加了缓存：

1. **用户信息查询** (`get_user`)
   - 缓存时间: 15分钟
   - 缓存键: `user:{username}`

2. **用户认证** (`verify_user`)
   - 缓存时间: 5分钟
   - 缓存键: `auth_success:{username}:{password_prefix}`

3. **用户计数** (`get_user_count`)
   - 缓存时间: 10分钟
   - 缓存键: `user_count`

### 缓存失效策略

- **用户密码更新**: 清理用户信息缓存和认证缓存
- **用户删除**: 清理用户信息缓存、认证缓存和用户计数缓存
- **用户添加**: 清理用户计数缓存

## API接口

缓存系统提供了RESTful API接口用于监控和管理：

### 缓存统计
```
GET /api/cache/stats
```

### 获取所有键
```
GET /api/cache/keys
```

### 获取缓存值
```
GET /api/cache/{key}
```

### 设置缓存值
```
POST /api/cache/{key}
Body: {"value": "...", "ttl": 300}
```

### 删除缓存
```
DELETE /api/cache/{key}
```

### 批量操作
```
POST /api/cache/batch/get
POST /api/cache/batch/set
DELETE /api/cache/batch/delete
```

### 清空缓存
```
DELETE /api/cache/clear
```

### 健康检查
```
GET /api/cache/health
```

## 性能优化建议

1. **合理设置TTL**: 根据数据更新频率设置合适的过期时间
2. **避免大对象缓存**: 缓存小而频繁访问的数据
3. **使用批量操作**: 减少网络往返次数
4. **监控缓存命中率**: 通过API接口监控缓存效果
5. **生产环境使用Redis**: 获得更好的性能和可靠性

## 故障排除

### 常见问题

1. **Redis连接失败**
   - 检查Redis服务是否启动
   - 验证REDIS_URL配置是否正确
   - 检查网络连接和防火墙设置

2. **缓存未生效**
   - 确认缓存服务已正确初始化
   - 检查TTL设置是否合理
   - 查看应用日志中的缓存相关信息

3. **内存使用过高**
   - 调整MEMORY_CACHE_MAX_SIZE参数
   - 考虑使用Redis缓存
   - 优化缓存键的设计

### 日志监控

缓存操作会记录详细的日志信息，包括：
- 缓存命中/未命中
- 缓存设置/删除操作
- 错误和警告信息

通过查看日志可以了解缓存系统的运行状态和性能表现。