import json
import logging
from aiohttp import web, WSMsgType

logger = logging.getLogger(__name__)

async def handle_dialogue(request: web.Request) -> web.Response:
    """处理对话请求"""
    try:
        # 解析请求数据
        data = await request.json()
        logger.debug(f"收到对话请求: {data}")

        # 获取对话服务并处理请求
        dialogue_service = request.app['dialogue_service']
        response_data = dialogue_service.process(data)

        logger.debug(f"对话响应: {response_data}")
        return web.json_response(response_data)
    except Exception as e:
        logger.error(f"处理对话请求出错: {e}")
        return web.json_response(
            {'error': '处理请求时出错', 'details': str(e)}, 
            status=500
        )

async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    """处理WebSocket连接"""
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    logger.info("WebSocket连接已建立")

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                logger.debug(f"收到WebSocket消息: {msg.data}")
                # 回显消息
                await ws.send_str(msg.data)
                # 也可以在这里处理消息并调用相关服务
            elif msg.type == WSMsgType.ERROR:
                logger.error(f"WebSocket连接出错: {ws.exception()}")
    finally:
        logger.info("WebSocket连接已关闭")

    return ws