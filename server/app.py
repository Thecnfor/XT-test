from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import signal
import sys
import asyncio
import threading
from api.auth import router as auth_router
from api.chat import router as chat_router
from api.log import router as log_router
from api.websocket import router as websocket_router
from config import SERVER_PORT, UVICORN_WORKERS
from middleware.logging_middleware import LoggingMiddleware

# 创建FastAPI应用
app = FastAPI()

# 全局变量用于跟踪服务器状态
server_running = True
server_thread = None

# 清理任务
async def cleanup():
    # 在这里添加清理逻辑，如关闭数据库连接等
    print("正在进行清理工作...")
    # 清除所有会话
    from services.session_service import SessionService
    from config import SESSION_FILE, SESSION_EXPIRE_MINUTES
    session_service = SessionService(SESSION_FILE, SESSION_EXPIRE_MINUTES)
    session_service.clear_all_sessions()
    print("已清除所有会话")
    print("清理完成，应用已退出。")

# 信号处理函数
def handle_shutdown(sig, frame):
    global server_running
    print(f"接收到信号 {sig}，正在关闭服务器...")
    server_running = False
    # 运行清理任务
    asyncio.run(cleanup())
    sys.exit(0)

# 注册信号处理
signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

# 添加CORS中间件，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "ws://localhost:3000",
        "ws://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册API路由
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(log_router)
app.include_router(websocket_router)

# 导入数据库初始化函数
from services.database_service import init_db

# 初始化数据库
init_db()

# 添加日志中间件
app.add_middleware(LoggingMiddleware)
print("日志中间件已添加")

# 根路由
@app.get("/")
async def root():
    return {"message": "Welcome to the backend API!"}

# 调试路由：列出所有路由
@app.get("/debug/routes")
async def list_routes():
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if hasattr(route, 'methods') else [],
                "name": getattr(route, 'name', 'Unknown')
            })
        elif hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "type": "WebSocket" if "websocket" in str(type(route)).lower() else "Other",
                "name": getattr(route, 'name', 'Unknown')
            })
    return {"routes": routes}

if __name__ == "__main__":
    print(f"启动服务器，监听端口 {SERVER_PORT}...")
    print("WebSocket服务已启用")
    
    try:
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=SERVER_PORT,
            workers=1,  # WebSocket需要单worker模式
            reload=False,
            log_level="info"
        )
    except KeyboardInterrupt:
        handle_shutdown(signal.SIGINT, None)