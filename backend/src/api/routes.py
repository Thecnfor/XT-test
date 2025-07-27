from aiohttp import web
from .handlers import handle_dialogue, websocket_handler

def setup_routes(app: web.Application) -> None:
    """设置应用路由"""
    # HTTP路由
    app.router.add_post('/dialogue', handle_dialogue)
    app.router.add_get('/', lambda _: web.Response(text='服务器正常运行'))

    # WebSocket路由
    app.router.add_get('/ws', websocket_handler)