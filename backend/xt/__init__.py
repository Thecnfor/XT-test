# Xrak后端包初始化
from .app import create_app
from .socketio import socketio

__all__ = ['create_app', 'socketio']