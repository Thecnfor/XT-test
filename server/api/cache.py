from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any
from services.cache_service import get_cache_service, CacheService
from pydantic import BaseModel
import logging

# 设置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api/cache", tags=["cache"])

# Pydantic模型
class CacheItem(BaseModel):
    key: str
    value: Any
    ttl: Optional[int] = None

class CacheKeyPattern(BaseModel):
    pattern: str = "*"

class CacheResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

# 依赖注入：获取缓存服务
def get_cache() -> CacheService:
    return get_cache_service()

@router.get("/stats", response_model=CacheResponse)
async def get_cache_stats(cache: CacheService = Depends(get_cache)):
    """获取缓存统计信息"""
    try:
        stats = cache.get_stats()
        return CacheResponse(
            success=True,
            message="缓存统计信息获取成功",
            data=stats
        )
    except Exception as e:
        logger.error(f"获取缓存统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取缓存统计失败: {str(e)}")

@router.get("/keys", response_model=CacheResponse)
async def get_cache_keys(
    pattern: str = "*",
    cache: CacheService = Depends(get_cache)
):
    """获取匹配模式的缓存键列表"""
    try:
        keys = await cache.keys(pattern)
        return CacheResponse(
            success=True,
            message=f"找到 {len(keys)} 个匹配的键",
            data=keys
        )
    except Exception as e:
        logger.error(f"获取缓存键失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取缓存键失败: {str(e)}")

@router.get("/get/{key}", response_model=CacheResponse)
async def get_cache_value(
    key: str,
    cache: CacheService = Depends(get_cache)
):
    """获取指定键的缓存值"""
    try:
        value = await cache.get(key)
        if value is None:
            return CacheResponse(
                success=False,
                message="缓存键不存在或已过期",
                data=None
            )
        
        return CacheResponse(
            success=True,
            message="缓存值获取成功",
            data=value
        )
    except Exception as e:
        logger.error(f"获取缓存值失败 {key}: {e}")
        raise HTTPException(status_code=500, detail=f"获取缓存值失败: {str(e)}")

@router.post("/set", response_model=CacheResponse)
async def set_cache_value(
    item: CacheItem,
    cache: CacheService = Depends(get_cache)
):
    """设置缓存值"""
    try:
        success = await cache.set(item.key, item.value, item.ttl)
        if success:
            return CacheResponse(
                success=True,
                message="缓存设置成功",
                data={"key": item.key, "ttl": item.ttl}
            )
        else:
            return CacheResponse(
                success=False,
                message="缓存设置失败"
            )
    except Exception as e:
        logger.error(f"设置缓存失败 {item.key}: {e}")
        raise HTTPException(status_code=500, detail=f"设置缓存失败: {str(e)}")

@router.delete("/delete/{key}", response_model=CacheResponse)
async def delete_cache_value(
    key: str,
    cache: CacheService = Depends(get_cache)
):
    """删除指定键的缓存"""
    try:
        success = await cache.delete(key)
        if success:
            return CacheResponse(
                success=True,
                message="缓存删除成功",
                data={"key": key}
            )
        else:
            return CacheResponse(
                success=False,
                message="缓存键不存在"
            )
    except Exception as e:
        logger.error(f"删除缓存失败 {key}: {e}")
        raise HTTPException(status_code=500, detail=f"删除缓存失败: {str(e)}")

@router.post("/clear", response_model=CacheResponse)
async def clear_cache(
    cache: CacheService = Depends(get_cache)
):
    """清空所有缓存"""
    try:
        success = await cache.clear()
        if success:
            return CacheResponse(
                success=True,
                message="缓存清空成功"
            )
        else:
            return CacheResponse(
                success=False,
                message="缓存清空失败"
            )
    except Exception as e:
        logger.error(f"清空缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"清空缓存失败: {str(e)}")

@router.get("/exists/{key}", response_model=CacheResponse)
async def check_cache_exists(
    key: str,
    cache: CacheService = Depends(get_cache)
):
    """检查缓存键是否存在"""
    try:
        exists = await cache.exists(key)
        return CacheResponse(
            success=True,
            message="检查完成",
            data={"key": key, "exists": exists}
        )
    except Exception as e:
        logger.error(f"检查缓存存在性失败 {key}: {e}")
        raise HTTPException(status_code=500, detail=f"检查缓存存在性失败: {str(e)}")

@router.post("/batch/set", response_model=CacheResponse)
async def batch_set_cache(
    items: List[CacheItem],
    cache: CacheService = Depends(get_cache)
):
    """批量设置缓存"""
    try:
        results = []
        for item in items:
            success = await cache.set(item.key, item.value, item.ttl)
            results.append({
                "key": item.key,
                "success": success
            })
        
        successful_count = sum(1 for r in results if r["success"])
        
        return CacheResponse(
            success=True,
            message=f"批量设置完成，成功 {successful_count}/{len(items)} 项",
            data=results
        )
    except Exception as e:
        logger.error(f"批量设置缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量设置缓存失败: {str(e)}")

@router.post("/batch/delete", response_model=CacheResponse)
async def batch_delete_cache(
    keys: List[str],
    cache: CacheService = Depends(get_cache)
):
    """批量删除缓存"""
    try:
        results = []
        for key in keys:
            success = await cache.delete(key)
            results.append({
                "key": key,
                "success": success
            })
        
        successful_count = sum(1 for r in results if r["success"])
        
        return CacheResponse(
            success=True,
            message=f"批量删除完成，成功 {successful_count}/{len(keys)} 项",
            data=results
        )
    except Exception as e:
        logger.error(f"批量删除缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量删除缓存失败: {str(e)}")

@router.get("/health", response_model=CacheResponse)
async def cache_health_check(
    cache: CacheService = Depends(get_cache)
):
    """缓存健康检查"""
    try:
        # 测试基本操作
        test_key = "__health_check__"
        test_value = "ok"
        
        # 设置测试值
        set_success = await cache.set(test_key, test_value, 60)
        if not set_success:
            return CacheResponse(
                success=False,
                message="缓存设置测试失败"
            )
        
        # 获取测试值
        get_value = await cache.get(test_key)
        if get_value != test_value:
            return CacheResponse(
                success=False,
                message="缓存获取测试失败"
            )
        
        # 删除测试值
        delete_success = await cache.delete(test_key)
        if not delete_success:
            return CacheResponse(
                success=False,
                message="缓存删除测试失败"
            )
        
        stats = cache.get_stats()
        
        return CacheResponse(
            success=True,
            message="缓存系统健康",
            data={
                "status": "healthy",
                "stats": stats
            }
        )
    except Exception as e:
        logger.error(f"缓存健康检查失败: {e}")
        return CacheResponse(
            success=False,
            message=f"缓存系统异常: {str(e)}"
        )