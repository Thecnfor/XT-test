@echo off

echo 启动 HTTP 服务器...
start /b python -m src.server

echo 启动 WebSocket 服务器...
start /b python -m src.main

echo 服务器已启动！
echo HTTP 服务器运行在 http://localhost:8000
echo WebSocket 服务器运行在 ws://localhost:8765