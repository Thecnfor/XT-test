import asyncio
import logging
from aiohttp import web
from .config import config
from .api.routes import setup_routes
from .services.dialogue_service import DialogueService

# 配置日志
logging.basicConfig(
    level=logging.DEBUG if config.DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def on_startup(app: web.Application) -> None:
    """应用启动时执行"""
    logger.info(f"应用启动，HTTP端口: {config.HTTP_PORT}, WebSocket端口: {config.WS_PORT}")
    # 初始化服务
    app['dialogue_service'] = DialogueService()

async def on_cleanup(app: web.Application) -> None:
    """应用关闭时执行"""
    logger.info("应用关闭")

def create_app() -> web.Application:
    """创建aiohttp应用"""
    app = web.Application()

    # 注册生命周期回调
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    # 设置路由
    setup_routes(app)

    return app

if __name__ == '__main__':
    app = create_app()
    web.run_app(app, host='0.0.0.0', port=config.HTTP_PORT)