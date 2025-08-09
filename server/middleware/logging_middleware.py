import time
import json
import logging
from datetime import datetime
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from services.log_service import LogService

# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("app_logger")

class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.log_service = LogService()

    async def dispatch(self, request: Request, call_next):
        # 记录请求开始时间
        start_time = time.time()
        timestamp = datetime.now().isoformat()
        client_ip = request.client.host
        path = request.url.path
        method = request.method

        # 记录请求信息
        request_data = {
            "timestamp": timestamp,
            "client_ip": client_ip,
            "path": path,
            "method": method,
            "headers": dict(request.headers),
            "query_params": dict(request.query_params)
        }

        # 如果是POST请求，尝试获取请求体
        if method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                request_data["body"] = body.decode() if body else ""
            except Exception as e:
                logger.error(f"无法获取请求体: {str(e)}")
                request_data["body"] = "无法获取请求体"

        logger.info(f"收到请求: {method} {path}")

        try:
            # 处理请求
            response = await call_next(request)

            # 计算请求处理时间
            processing_time = time.time() - start_time
            status_code = response.status_code

            # 记录响应信息
            response_data = {
                "status_code": status_code,
                "processing_time_ms": round(processing_time * 1000, 2),
                "headers": dict(response.headers)
            }

            # 合并请求和响应信息
            log_entry = {
                **request_data,
                **response_data
            }

            # 根据状态码记录不同级别的日志
            if status_code >= 500:
                logger.error(f"请求失败: {method} {path} {status_code}")
                log_entry["level"] = "error"
            elif status_code >= 400:
                logger.warning(f"请求警告: {method} {path} {status_code}")
                log_entry["level"] = "warning"
            else:
                logger.info(f"请求成功: {method} {path} {status_code}")
                log_entry["level"] = "info"

            # 存储日志
            self.log_service.save_log(log_entry)

            return response

        except Exception as e:
            # 记录异常信息
            processing_time = time.time() - start_time
            error_log = {
                **request_data,
                "status_code": 500,
                "processing_time_ms": round(processing_time * 1000, 2),
                "error": str(e),
                "level": "error"
            }

            logger.error(f"请求异常: {method} {path} - {str(e)}")
            self.log_service.save_log(error_log)

            # 重新抛出异常，让FastAPI处理
            raise
