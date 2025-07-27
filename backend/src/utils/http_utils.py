import asyncio
import logging
import aiohttp
from typing import Dict, Any, Optional
from ..config import config

logger = logging.getLogger(__name__)

class HttpUtils:
    """HTTP工具类，封装HTTP请求相关功能"""

    @staticmethod
    async def send_request(
        url: str,
        method: str = 'GET',
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """发送HTTP请求

        Args:
            url: 请求URL
            method: 请求方法，默认为GET
            data: 请求数据
            headers: 请求头

        Returns:
            包含响应结果的字典
        """
        timeout = aiohttp.ClientTimeout(total=config.API_TIMEOUT)
        retry_count = 0

        while retry_count < config.MAX_RETRIES:
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    request_kwargs = {
                        'url': url,
                        'headers': headers or {'Content-Type': 'application/json'}
                    }

                    if data and method in ['POST', 'PUT', 'PATCH']:
                        request_kwargs['json'] = data

                    logger.debug(f"发送{method}请求到{url}")
                    async with getattr(session, method.lower())(**request_kwargs) as response:
                        response_data = await response.json()
                        logger.debug(f"收到响应: {response_data}")
                        return {
                            'status': response.status,
                            'data': response_data,
                            'success': 200 <= response.status < 300
                        }
            except Exception as e:
                retry_count += 1
                logger.warning(f"请求失败({retry_count}/{config.MAX_RETRIES}): {e}")
                if retry_count >= config.MAX_RETRIES:
                    logger.error(f"请求失败，已达到最大重试次数: {e}")
                    return {
                        'status': 500,
                        'data': {'error': str(e)},
                        'success': False
                    }
                await asyncio.sleep(1)  # 重试前等待1秒