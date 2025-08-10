# 日志服务优化文档

## 概述

本文档描述了对日志服务的全面优化，包括结构化日志、性能监控、批量写入、异步操作等功能。

## 主要优化特性

### 1. 结构化日志

#### 日志级别枚举
```python
class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"
```

#### 日志分类枚举
```python
class LogCategory(Enum):
    API = "API"
    AUTH = "AUTH"
    DATABASE = "DATABASE"
    CACHE = "CACHE"
    SESSION = "SESSION"
    WEBSOCKET = "WEBSOCKET"
    SYSTEM = "SYSTEM"
    PERFORMANCE = "PERFORMANCE"
    SECURITY = "SECURITY"
```

#### 结构化日志条目
```python
@dataclass
class LogEntry:
    timestamp: str
    level: str
    category: str
    message: str
    path: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    response_time: Optional[float] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    error_code: Optional[str] = None
    stack_trace: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None
```

### 2. 性能监控

#### 性能指标数据结构
```python
@dataclass
class PerformanceMetrics:
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    active_connections: int
    request_count: int
    error_count: int
    avg_response_time: float
    timestamp: str
```

#### 监控功能
- **系统性能监控**: CPU使用率、内存使用率、磁盘使用率
- **应用性能监控**: 请求数量、错误数量、平均响应时间
- **实时指标收集**: 每分钟自动收集性能数据
- **历史数据存储**: 性能指标持久化到文件

### 3. 批量写入优化

#### 配置参数
- `batch_size`: 批量写入大小（默认50条）
- `flush_interval`: 刷新间隔（默认5秒）
- `max_cache_size`: 缓存大小（默认2000条）
- `max_file_size`: 文件大小限制（默认50MB）
- `retention_days`: 日志保留天数（默认30天）

#### 优化策略
- **延迟写入**: 日志先存储在内存队列中
- **批量刷新**: 达到批量大小或时间间隔时批量写入
- **异步操作**: 支持异步文件写入操作
- **原子写入**: 使用临时文件确保写入原子性

### 4. 文件管理

#### 日志轮转
- **大文件压缩**: 超过50MB的文件自动压缩
- **过期清理**: 自动清理超过保留期的日志文件
- **压缩存储**: 使用gzip压缩节省存储空间

#### 文件命名规则
- 应用日志: `app_logs_YYYYMMDD.jsonl`
- 性能指标: `performance_YYYYMMDD.jsonl`
- 压缩文件: `*.jsonl.gz`

### 5. 内存优化

#### 数据结构
- **双端队列**: 使用deque提高插入和删除性能
- **LRU缓存**: 自动限制缓存大小
- **统计指标**: 实时维护各种统计数据

#### 缓存策略
- **日志缓存**: 最近2000条日志保存在内存中
- **性能缓存**: 最近100个性能指标保存在内存中
- **去重处理**: 查询时自动去除重复日志

## 使用方法

### 1. 基本日志记录

```python
from services.log_service import log_service, LogLevel, LogCategory

# 保存基本日志
log_service.save_log({
    "level": "INFO",
    "category": "API",
    "message": "用户登录成功",
    "user_id": "12345",
    "ip_address": "192.168.1.1"
})

# 保存结构化日志
log_service.save_structured_log(
    level=LogLevel.INFO,
    category=LogCategory.AUTH,
    message="用户认证成功",
    user_id="12345",
    session_id="session_abc",
    response_time=0.15
)
```

### 2. 查询日志

```python
# 基本查询
result = log_service.get_logs(limit=100)

# 条件查询
result = log_service.get_logs(
    start_time="2024-01-01T00:00:00Z",
    end_time="2024-01-02T00:00:00Z",
    level="ERROR",
    category="API",
    limit=50,
    offset=0
)

# 查询结果包含统计信息
print(f"总数: {result['total']}")
print(f"日志: {result['logs']}")
print(f"统计: {result['metrics']}")
```

### 3. 性能监控

```python
# 获取性能指标
metrics = log_service.get_performance_metrics(hours=24)

print(f"CPU使用率: {metrics['cpu_usage']}")
print(f"内存使用率: {metrics['memory_usage']}")
print(f"响应时间: {metrics['response_time']}")
print(f"总请求数: {metrics['total_requests']}")
print(f"总错误数: {metrics['total_errors']}")
```

### 4. 服务管理

```python
# 获取服务统计
stats = log_service.get_service_stats()

# 强制刷新日志
log_service.force_flush()

# 异步强制刷新
await log_service.async_force_flush()

# 清空缓存
log_service.clear_cache()

# 关闭服务
log_service.shutdown()
```

## 配置说明

### 性能优化配置

```python
class OptimizedLogService:
    def __init__(self):
        # 性能优化配置
        self.batch_size = 50  # 批量写入大小
        self.flush_interval = 5  # 刷新间隔（秒）
        self.max_cache_size = 2000  # 缓存大小
        self.max_file_size = 50 * 1024 * 1024  # 50MB文件大小限制
        self.retention_days = 30  # 日志保留天数
```

### 定时任务

- **刷新任务**: 每5秒执行一次，刷新待写入日志
- **性能监控**: 每60秒执行一次，收集性能指标
- **清理任务**: 每24小时执行一次，清理过期文件和轮转大文件

## 性能提升

### 写入性能
- **批量写入**: 减少文件I/O操作次数
- **异步操作**: 避免阻塞主线程
- **内存缓冲**: 减少磁盘访问频率

### 查询性能
- **内存缓存**: 最新日志直接从内存获取
- **索引优化**: 按时间戳排序提高查询效率
- **分页支持**: 避免加载大量数据

### 存储优化
- **文件压缩**: 节省磁盘空间
- **自动清理**: 避免磁盘空间耗尽
- **文件轮转**: 保持文件大小合理

## 监控指标

### 系统指标
- CPU使用率
- 内存使用率
- 磁盘使用率

### 应用指标
- 总日志数量
- 各级别日志分布
- 各分类日志分布
- 平均响应时间
- 错误率
- 请求数量

### 服务指标
- 缓存大小
- 待写入日志数量
- 性能缓存大小

## 故障排除

### 常见问题

1. **日志写入失败**
   - 检查磁盘空间
   - 检查文件权限
   - 查看错误日志

2. **性能监控异常**
   - 确认psutil库已安装
   - 检查系统权限
   - 查看监控任务日志

3. **缓存溢出**
   - 调整max_cache_size参数
   - 减少flush_interval间隔
   - 增加batch_size大小

### 日志级别

服务内部使用标准Python logging记录运行状态：
- INFO: 正常操作信息
- ERROR: 错误信息
- DEBUG: 调试信息

## 向后兼容性

为了保持向后兼容性，原始的`LogService`类名仍然可用：

```python
# 这两种方式都可以使用
from services.log_service import LogService, OptimizedLogService

# LogService 是 OptimizedLogService 的别名
log_service = LogService()  # 实际创建的是 OptimizedLogService 实例
```

## 依赖要求

新增依赖：
- `psutil>=5.8.0`: 系统性能监控
- `aiofiles>=0.8.0`: 异步文件操作

确保在requirements.txt中包含这些依赖。