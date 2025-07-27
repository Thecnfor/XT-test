@echo off

REM 启动统一应用服务器
start /b python -m src.app

REM 等待1秒
ping -n 2 127.0.0.1 > nul

echo 服务器已启动！
echo 应用服务器运行在 http://localhost:8000
echo WebSocket服务可用在 ws://localhost:8000/ws
pause