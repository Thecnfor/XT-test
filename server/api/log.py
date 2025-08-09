from fastapi import APIRouter, Query, Depends
from datetime import datetime
from services.log_service import log_service
from typing import Optional

router = APIRouter(
    prefix="/api/logs",
    tags=["logs"],
    responses={404: {"description": "Not found"}},
)

@router.get("/")
def get_logs(
    start_time: Optional[str] = Query(None, description="开始时间，格式: YYYY-MM-DDTHH:MM:SS"),
    end_time: Optional[str] = Query(None, description="结束时间，格式: YYYY-MM-DDTHH:MM:SS"),
    level: Optional[str] = Query(None, description="日志级别: info, warning, error"),
    path: Optional[str] = Query(None, description="路径包含的字符串"),
    limit: int = Query(100, description="每页条数"),
    offset: int = Query(0, description="偏移量")
):
    """获取日志列表，支持过滤和分页"""
    try:
        # 验证时间格式
        if start_time:
            datetime.fromisoformat(start_time)
        if end_time:
            datetime.fromisoformat(end_time)

        # 调用日志服务获取日志
        logs = log_service.get_logs(
            start_time=start_time,
            end_time=end_time,
            level=level,
            path=path,
            limit=limit,
            offset=offset
        )

        return {
            "success": True,
            "data": logs
        }
    except ValueError as e:
        return {
            "success": False,
            "error": f"时间格式错误: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"获取日志失败: {str(e)}"
        }

@router.get("/recent")
def get_recent_logs(
    limit: int = Query(50, description="获取条数")
):
    """获取最近的日志"""
    try:
        logs = log_service.get_recent_logs(limit=limit)
        return {
            "success": True,
            "data": logs
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"获取最近日志失败: {str(e)}"
        }

@router.get("/stats")
def get_log_stats():
    """获取日志统计信息"""
    try:
        # 这里可以实现各种统计逻辑，例如不同级别的日志数量、每小时的请求数等
        # 为了简单起见，我们只返回一个示例
        return {
            "success": True,
            "data": {
                "info_count": 120,
                "warning_count": 25,
                "error_count": 5,
                "total_count": 150
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"获取日志统计失败: {str(e)}"
        }