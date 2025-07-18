from flask import Flask
from .config import config
from .socketio import socketio
from . import events  # 导入事件处理模块以注册事件


def create_app(config_name='default'):
    """创建Flask应用实例"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # 初始化SocketIO
    socketio.init_app(app, cors_allowed_origins="*")

    return app