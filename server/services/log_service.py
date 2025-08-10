import json
import os
import time
import asyncio
import gzip
import threading
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from threading import Lock, Timer
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from enum import Enum
import aiofiles
import psutil

# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("log_service")

class LogLevel(Enum):
    """日志级别枚举"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class LogCategory(Enum):
    """日志分类枚举"""
    API = "API"
    AUTH = "AUTH"
    DATABASE = "DATABASE"
    CACHE = "CACHE"
    SESSION = "SESSION"
    WEBSOCKET = "WEBSOCKET"
    SYSTEM = "SYSTEM"
    PERFORMANCE = "PERFORMANCE"
    SECURITY = "SECURITY"

@dataclass
class LogEntry:
    """结构化日志条目"""
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
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {k: v for k, v in asdict(self).items() if v is not None}

@dataclass
class PerformanceMetrics:
    """性能指标"""
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    active_connections: int
    request_count: int
    error_count: int
    avg_response_time: float
    timestamp: str

class OptimizedLogService:
    def __init__(self):
        # 基础配置
        self.log_dir = "d:/Xrak/XT-test/server/logs"
        os.makedirs(self.log_dir, exist_ok=True)
        self.log_file_prefix = "app_logs_"
        self.performance_file_prefix = "performance_"
        
        # 性能优化配置
        self.batch_size = 50  # 批量写入大小
        self.flush_interval = 5  # 刷新间隔（秒）
        self.max_cache_size = 2000  # 缓存大小
        self.max_file_size = 50 * 1024 * 1024  # 50MB文件大小限制
        self.retention_days = 30  # 日志保留天数
        
        # 内存数据结构
        self.log_cache = deque(maxlen=self.max_cache_size)
        self.pending_logs = []
        self.performance_cache = deque(maxlen=100)
        
        # 性能监控指标
        self.metrics = {
            'total_logs': 0,
            'logs_per_level': defaultdict(int),
            'logs_per_category': defaultdict(int),
            'avg_response_times': deque(maxlen=1000),
            'error_rates': deque(maxlen=100),
            'request_counts': deque(maxlen=100)
        }
        
        # 线程安全
        self.lock = Lock()
        self.flush_timer: Optional[Timer] = None
        self._shutdown = False
        
        # 启动定期任务
        self._start_flush_timer()
        self._start_performance_monitor()
        self._start_cleanup_timer()
        
        logger.info("优化日志服务已初始化")

    def _start_flush_timer(self):
        """启动定期刷新定时器"""
        def flush_task():
            if not self._shutdown:
                try:
                    self._flush_pending_logs()
                except Exception as e:
                    logger.error(f"定期刷新任务失败: {e}")
                finally:
                    if not self._shutdown:
                        self.flush_timer = Timer(self.flush_interval, flush_task)
                        self.flush_timer.start()
        
        self.flush_timer = Timer(self.flush_interval, flush_task)
        self.flush_timer.start()

    def _start_performance_monitor(self):
        """启动性能监控"""
        def monitor_task():
            if not self._shutdown:
                try:
                    self._collect_performance_metrics()
                except Exception as e:
                    logger.error(f"性能监控任务失败: {e}")
                finally:
                    if not self._shutdown:
                        Timer(60, monitor_task).start()  # 每分钟收集一次
        
        Timer(60, monitor_task).start()

    def _start_cleanup_timer(self):
        """启动清理定时器"""
        def cleanup_task():
            if not self._shutdown:
                try:
                    self._cleanup_old_logs()
                    self._rotate_large_files()
                except Exception as e:
                    logger.error(f"清理任务失败: {e}")
                finally:
                    if not self._shutdown:
                        Timer(24 * 3600, cleanup_task).start()  # 每天执行一次
        
        Timer(24 * 3600, cleanup_task).start()

    def _collect_performance_metrics(self):
        """收集性能指标"""
        try:
            # 系统性能指标
            cpu_usage = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage(self.log_dir)
            
            # 应用性能指标
            with self.lock:
                request_count = sum(self.metrics['request_counts']) if self.metrics['request_counts'] else 0
                error_count = sum(self.metrics['error_rates']) if self.metrics['error_rates'] else 0
                avg_response_time = sum(self.metrics['avg_response_times']) / len(self.metrics['avg_response_times']) if self.metrics['avg_response_times'] else 0
            
            metrics = PerformanceMetrics(
                cpu_usage=cpu_usage,
                memory_usage=memory.percent,
                disk_usage=disk.percent,
                active_connections=0,  # 需要从其他服务获取
                request_count=request_count,
                error_count=error_count,
                avg_response_time=avg_response_time,
                timestamp=datetime.utcnow().isoformat()
            )
            
            self.performance_cache.append(metrics)
            self._save_performance_metrics(metrics)
            
        except Exception as e:
            logger.error(f"收集性能指标失败: {e}")

    def _save_performance_metrics(self, metrics: PerformanceMetrics):
        """保存性能指标"""
        try:
            today = datetime.now().strftime("%Y%m%d")
            perf_file = os.path.join(self.log_dir, f"{self.performance_file_prefix}{today}.jsonl")
            
            with open(perf_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(asdict(metrics), ensure_ascii=False) + "\n")
                
        except Exception as e:
            logger.error(f"保存性能指标失败: {e}")

    def save_log(self, log_entry: Dict[str, Any]):
        """保存日志条目（优化版本）"""
        # 标准化日志条目
        if isinstance(log_entry, dict):
            # 确保必要字段存在
            if 'timestamp' not in log_entry:
                log_entry['timestamp'] = datetime.utcnow().isoformat()
            if 'level' not in log_entry:
                log_entry['level'] = LogLevel.INFO.value
            if 'category' not in log_entry:
                log_entry['category'] = LogCategory.SYSTEM.value
        
        with self.lock:
            # 添加到缓存
            self.log_cache.append(log_entry)
            
            # 添加到待写入队列
            self.pending_logs.append(log_entry)
            
            # 更新统计指标
            self.metrics['total_logs'] += 1
            self.metrics['logs_per_level'][log_entry.get('level', 'UNKNOWN')] += 1
            self.metrics['logs_per_category'][log_entry.get('category', 'UNKNOWN')] += 1
            
            # 记录响应时间
            if 'response_time' in log_entry and log_entry['response_time'] is not None:
                self.metrics['avg_response_times'].append(log_entry['response_time'])
            
            # 记录错误
            if log_entry.get('level') in ['ERROR', 'CRITICAL']:
                self.metrics['error_rates'].append(1)
            
            # 如果达到批量大小，立即刷新
            if len(self.pending_logs) >= self.batch_size:
                self._flush_pending_logs()

    def save_structured_log(self, level: LogLevel, category: LogCategory, message: str, **kwargs):
        """保存结构化日志"""
        log_entry = LogEntry(
            timestamp=datetime.utcnow().isoformat(),
            level=level.value,
            category=category.value,
            message=message,
            **kwargs
        )
        self.save_log(log_entry.to_dict())

    def _flush_pending_logs(self):
        """刷新待写入的日志"""
        with self.lock:
            if not self.pending_logs:
                return
            
            logs_to_write = self.pending_logs.copy()
            self.pending_logs.clear()
        
        try:
            # 按日期分组
            logs_by_date = defaultdict(list)
            for log in logs_to_write:
                timestamp = log.get('timestamp', datetime.utcnow().isoformat())
                date = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).strftime("%Y%m%d")
                logs_by_date[date].append(log)
            
            # 批量写入每个日期的日志
            for date, logs in logs_by_date.items():
                log_file = os.path.join(self.log_dir, f"{self.log_file_prefix}{date}.jsonl")
                
                with open(log_file, "a", encoding="utf-8") as f:
                    for log in logs:
                        f.write(json.dumps(log, ensure_ascii=False) + "\n")
            
            logger.debug(f"批量写入 {len(logs_to_write)} 条日志")
            
        except Exception as e:
            logger.error(f"批量写入日志失败: {e}")
            # 如果写入失败，将日志重新加入队列
            with self.lock:
                self.pending_logs.extend(logs_to_write)

    async def _async_flush_logs(self, logs_to_write: List[Dict]):
        """异步刷新日志"""
        try:
            # 按日期分组
            logs_by_date = defaultdict(list)
            for log in logs_to_write:
                timestamp = log.get('timestamp', datetime.utcnow().isoformat())
                date = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).strftime("%Y%m%d")
                logs_by_date[date].append(log)
            
            # 异步批量写入
            for date, logs in logs_by_date.items():
                log_file = os.path.join(self.log_dir, f"{self.log_file_prefix}{date}.jsonl")
                
                async with aiofiles.open(log_file, "a", encoding="utf-8") as f:
                    for log in logs:
                        await f.write(json.dumps(log, ensure_ascii=False) + "\n")
            
            logger.debug(f"异步批量写入 {len(logs_to_write)} 条日志")
            
        except Exception as e:
            logger.error(f"异步批量写入日志失败: {e}")

    def get_logs(self, start_time=None, end_time=None, level=None, category=None, path=None, limit=100, offset=0):
        """查询日志（优化版本）"""
        with self.lock:
            # 从缓存获取最新日志
            logs = list(self.log_cache)
            
            # 如果需要更多历史日志，从文件加载
            if start_time or offset > len(logs):
                file_logs = self._load_logs_from_files(start_time, end_time)
                logs.extend(file_logs)
            
            # 去重并排序
            unique_logs = {}
            for log in logs:
                key = f"{log.get('timestamp', '')}_{log.get('message', '')}"
                if key not in unique_logs:
                    unique_logs[key] = log
            
            logs = list(unique_logs.values())
            logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            
            # 应用过滤条件
            filtered_logs = self._filter_logs(logs, start_time, end_time, level, category, path)
            
            # 应用分页
            total = len(filtered_logs)
            paginated_logs = filtered_logs[offset:offset + limit]
            
            return {
                "total": total,
                "logs": paginated_logs,
                "metrics": self._get_log_metrics(filtered_logs)
            }

    def _load_logs_from_files(self, start_time=None, end_time=None) -> List[Dict]:
        """从文件加载日志"""
        logs = []
        
        # 确定日期范围
        if start_time:
            start_date = datetime.fromisoformat(start_time.replace('Z', '+00:00')).date()
        else:
            start_date = datetime.now().date() - timedelta(days=7)  # 默认加载最近7天
        
        if end_time:
            end_date = datetime.fromisoformat(end_time.replace('Z', '+00:00')).date()
        else:
            end_date = datetime.now().date()
        
        # 加载指定日期范围的日志文件
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y%m%d")
            log_file = os.path.join(self.log_dir, f"{self.log_file_prefix}{date_str}.jsonl")
            
            if os.path.exists(log_file):
                try:
                    with open(log_file, "r", encoding="utf-8") as f:
                        for line in f:
                            try:
                                log = json.loads(line.strip())
                                logs.append(log)
                            except json.JSONDecodeError:
                                continue
                except Exception as e:
                    logger.error(f"读取日志文件 {log_file} 失败: {e}")
            
            current_date += timedelta(days=1)
        
        return logs

    def _filter_logs(self, logs: List[Dict], start_time=None, end_time=None, level=None, category=None, path=None) -> List[Dict]:
        """过滤日志"""
        filtered_logs = []
        
        for log in logs:
            # 时间范围过滤
            if start_time and log.get("timestamp", "") < start_time:
                continue
            if end_time and log.get("timestamp", "") > end_time:
                continue
            
            # 日志级别过滤
            if level and log.get("level", "") != level:
                continue
            
            # 分类过滤
            if category and log.get("category", "") != category:
                continue
            
            # 路径过滤
            if path and path not in log.get("path", ""):
                continue
            
            filtered_logs.append(log)
        
        return filtered_logs

    def _get_log_metrics(self, logs: List[Dict]) -> Dict[str, Any]:
        """获取日志统计指标"""
        if not logs:
            return {}
        
        level_counts = defaultdict(int)
        category_counts = defaultdict(int)
        response_times = []
        
        for log in logs:
            level_counts[log.get('level', 'UNKNOWN')] += 1
            category_counts[log.get('category', 'UNKNOWN')] += 1
            
            if 'response_time' in log and log['response_time'] is not None:
                response_times.append(log['response_time'])
        
        metrics = {
            'total_count': len(logs),
            'level_distribution': dict(level_counts),
            'category_distribution': dict(category_counts),
        }
        
        if response_times:
            metrics['response_time_stats'] = {
                'avg': sum(response_times) / len(response_times),
                'min': min(response_times),
                'max': max(response_times),
                'count': len(response_times)
            }
        
        return metrics

    def get_performance_metrics(self, hours=24) -> Dict[str, Any]:
        """获取性能指标"""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        # 从缓存获取最新指标
        recent_metrics = [m for m in self.performance_cache 
                         if datetime.fromisoformat(m.timestamp) >= start_time]
        
        # 从文件加载历史指标
        file_metrics = self._load_performance_from_files(start_time, end_time)
        
        all_metrics = recent_metrics + file_metrics
        
        if not all_metrics:
            return {}
        
        # 计算统计信息
        cpu_values = [m.cpu_usage for m in all_metrics]
        memory_values = [m.memory_usage for m in all_metrics]
        response_times = [m.avg_response_time for m in all_metrics if m.avg_response_time > 0]
        
        return {
            'time_range': {
                'start': start_time.isoformat(),
                'end': end_time.isoformat(),
                'hours': hours
            },
            'cpu_usage': {
                'avg': sum(cpu_values) / len(cpu_values),
                'min': min(cpu_values),
                'max': max(cpu_values)
            },
            'memory_usage': {
                'avg': sum(memory_values) / len(memory_values),
                'min': min(memory_values),
                'max': max(memory_values)
            },
            'response_time': {
                'avg': sum(response_times) / len(response_times) if response_times else 0,
                'min': min(response_times) if response_times else 0,
                'max': max(response_times) if response_times else 0
            },
            'total_requests': sum(m.request_count for m in all_metrics),
            'total_errors': sum(m.error_count for m in all_metrics),
            'data_points': len(all_metrics)
        }

    def _load_performance_from_files(self, start_time: datetime, end_time: datetime) -> List[PerformanceMetrics]:
        """从文件加载性能指标"""
        metrics = []
        
        current_date = start_time.date()
        end_date = end_time.date()
        
        while current_date <= end_date:
            date_str = current_date.strftime("%Y%m%d")
            perf_file = os.path.join(self.log_dir, f"{self.performance_file_prefix}{date_str}.jsonl")
            
            if os.path.exists(perf_file):
                try:
                    with open(perf_file, "r", encoding="utf-8") as f:
                        for line in f:
                            try:
                                data = json.loads(line.strip())
                                metric = PerformanceMetrics(**data)
                                metric_time = datetime.fromisoformat(metric.timestamp)
                                
                                if start_time <= metric_time <= end_time:
                                    metrics.append(metric)
                            except (json.JSONDecodeError, TypeError):
                                continue
                except Exception as e:
                    logger.error(f"读取性能文件 {perf_file} 失败: {e}")
            
            current_date += timedelta(days=1)
        
        return metrics

    def _cleanup_old_logs(self):
        """清理过期日志"""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.retention_days)
            
            for filename in os.listdir(self.log_dir):
                if filename.startswith(self.log_file_prefix) or filename.startswith(self.performance_file_prefix):
                    file_path = os.path.join(self.log_dir, filename)
                    file_stat = os.stat(file_path)
                    file_date = datetime.fromtimestamp(file_stat.st_mtime)
                    
                    if file_date < cutoff_date:
                        # 压缩后删除
                        self._compress_and_delete(file_path)
                        logger.info(f"清理过期日志文件: {filename}")
            
        except Exception as e:
            logger.error(f"清理过期日志失败: {e}")

    def _rotate_large_files(self):
        """轮转大文件"""
        try:
            for filename in os.listdir(self.log_dir):
                if filename.startswith(self.log_file_prefix) and filename.endswith('.jsonl'):
                    file_path = os.path.join(self.log_dir, filename)
                    
                    if os.path.getsize(file_path) > self.max_file_size:
                        # 压缩大文件
                        self._compress_file(file_path)
                        logger.info(f"轮转大文件: {filename}")
            
        except Exception as e:
            logger.error(f"文件轮转失败: {e}")

    def _compress_file(self, file_path: str):
        """压缩文件"""
        try:
            compressed_path = file_path + '.gz'
            
            with open(file_path, 'rb') as f_in:
                with gzip.open(compressed_path, 'wb') as f_out:
                    f_out.writelines(f_in)
            
            os.remove(file_path)
            
        except Exception as e:
            logger.error(f"压缩文件 {file_path} 失败: {e}")

    def _compress_and_delete(self, file_path: str):
        """压缩并删除文件"""
        try:
            self._compress_file(file_path)
        except Exception as e:
            logger.error(f"压缩删除文件 {file_path} 失败: {e}")

    def get_recent_logs(self, limit=50):
        """获取最近的日志"""
        return self.get_logs(limit=limit)

    def clear_cache(self):
        """清空日志缓存"""
        with self.lock:
            self.log_cache.clear()
            self.performance_cache.clear()
            logger.info("日志缓存已清空")

    def get_service_stats(self) -> Dict[str, Any]:
        """获取服务统计信息"""
        with self.lock:
            return {
                'total_logs': self.metrics['total_logs'],
                'cache_size': len(self.log_cache),
                'pending_logs': len(self.pending_logs),
                'logs_per_level': dict(self.metrics['logs_per_level']),
                'logs_per_category': dict(self.metrics['logs_per_category']),
                'performance_cache_size': len(self.performance_cache),
                'avg_response_time': sum(self.metrics['avg_response_times']) / len(self.metrics['avg_response_times']) if self.metrics['avg_response_times'] else 0,
                'error_rate': sum(self.metrics['error_rates']) / len(self.metrics['error_rates']) if self.metrics['error_rates'] else 0
            }

    def force_flush(self):
        """强制刷新所有待写入日志"""
        self._flush_pending_logs()

    async def async_force_flush(self):
        """异步强制刷新"""
        with self.lock:
            logs_to_write = self.pending_logs.copy()
            self.pending_logs.clear()
        
        if logs_to_write:
            await self._async_flush_logs(logs_to_write)

    def shutdown(self):
        """关闭日志服务"""
        logger.info("正在关闭日志服务...")
        self._shutdown = True
        
        # 取消定时器
        if self.flush_timer:
            self.flush_timer.cancel()
        
        # 刷新所有待写入日志
        self.force_flush()
        
        logger.info("日志服务已关闭")

# 为了向后兼容，保留原始类名的别名
LogService = OptimizedLogService

# 创建单例实例
log_service = LogService()