import json
import os
import time
from datetime import datetime, timedelta
import threading
import logging

# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("log_service")

class LogService:
    def __init__(self):
        # 日志存储目录
        self.log_dir = "d:/Xrak/XT-test/server/logs"
        # 确保日志目录存在
        os.makedirs(self.log_dir, exist_ok=True)
        # 日志文件前缀
        self.log_file_prefix = "app_logs_"
        # 线程锁，确保多线程环境下的安全访问
        self.lock = threading.Lock()
        # 内存中的日志缓存，用于快速查询
        self.log_cache = []
        # 缓存大小限制
        self.max_cache_size = 1000

    def save_log(self, log_entry):
        """保存日志条目到文件和缓存"""
        with self.lock:
            # 添加到缓存
            self.log_cache.append(log_entry)
            # 如果缓存超过大小限制，移除最旧的日志
            if len(self.log_cache) > self.max_cache_size:
                self.log_cache.pop(0)

            # 获取今天的日期作为文件名的一部分
            today = datetime.now().strftime("%Y%m%d")
            log_file = os.path.join(self.log_dir, f"{self.log_file_prefix}{today}.jsonl")

            try:
                # 以追加模式写入日志文件
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
            except Exception as e:
                logger.error(f"保存日志到文件失败: {str(e)}")

    def get_logs(self, start_time=None, end_time=None, level=None, path=None, limit=100, offset=0):
        """查询日志"""
        with self.lock:
            # 从文件和缓存中获取日志
            logs = []

            # 首先检查缓存
            if self.log_cache:
                logs.extend(self.log_cache)

            # 如果需要更旧的日志，从文件中加载
            if start_time:
                # 计算需要加载的日期范围
                current_date = datetime.now().date()
                start_date = datetime.fromisoformat(start_time).date()
                date_diff = (current_date - start_date).days

                # 加载指定日期范围内的日志文件
                for i in range(date_diff + 1):
                    date = (start_date + timedelta(days=i)).strftime("%Y%m%d")
                    log_file = os.path.join(self.log_dir, f"{self.log_file_prefix}{date}.jsonl")
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
                            logger.error(f"读取日志文件 {log_file} 失败: {str(e)}")

            # 按时间戳排序
            logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

            # 应用过滤条件
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

                # 路径过滤
                if path and path not in log.get("path", ""):
                    continue

                filtered_logs.append(log)

            # 应用分页
            total = len(filtered_logs)
            paginated_logs = filtered_logs[offset:offset + limit]

            return {
                "total": total,
                "logs": paginated_logs
            }

    def get_recent_logs(self, limit=50):
        """获取最近的日志"""
        return self.get_logs(limit=limit)

    def clear_cache(self):
        """清空日志缓存"""
        with self.lock:
            self.log_cache.clear()
            logger.info("日志缓存已清空")

# 创建单例实例
log_service = LogService()