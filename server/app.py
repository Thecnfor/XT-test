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
from api.cache import router as cache_router
from config import SERVER_PORT, UVICORN_WORKERS, USE_REDIS_CACHE, REDIS_URL
from middleware.logging_middleware import LoggingMiddleware

# 创建FastAPI应用
app = FastAPI()

# 全局变量用于跟踪服务器状态
server_running = True
server_thread = None

# 清理任务
def cleanup():
    # 在这里添加清理逻辑，如关闭数据库连接等
    print("正在进行清理工作...")
    # 关闭会话服务
    from services.session_service import SessionService
    from config import SESSION_FILE, SESSION_EXPIRE_MINUTES
    session_service = SessionService(SESSION_FILE, SESSION_EXPIRE_MINUTES)
    session_service.shutdown()  # 使用优化后的shutdown方法
    print("会话服务已关闭")
    print("清理完成，应用已退出。")

# 信号处理函数
def handle_shutdown(sig, frame):
    global server_running
    print(f"接收到信号 {sig}，正在关闭服务器...")
    server_running = False
    # 运行清理任务
    cleanup()
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
app.include_router(cache_router)

# 导入数据库和缓存初始化函数
from services.database_service import init_database
from services.cache_service import init_cache_service, close_cache_service

# 应用启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化任务"""
    print("正在初始化数据库...")
    await init_database()
    print("数据库初始化完成")
    
    print("正在初始化缓存服务...")
    await init_cache_service(use_redis=USE_REDIS_CACHE, redis_url=REDIS_URL)
    print("缓存服务初始化完成")

# 应用关闭事件
@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理任务"""
    print("正在关闭缓存服务...")
    await close_cache_service()
    print("缓存服务已关闭")
    
    print("正在关闭数据库连接...")
    from services.database_service import get_connection_pool
    pool = get_connection_pool()
    await pool.close_all()
    print("数据库连接已关闭")

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