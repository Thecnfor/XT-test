from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import signal
import sys
import asyncio
import threading
from api.auth import router as auth_router
from api.chat import router as chat_router
from config import SERVER_PORT, UVICORN_WORKERS

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
    await asyncio.sleep(1)  # 模拟清理工作
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
    allow_origins=["*"],  # 在生产环境中应限制为特定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册API路由
app.include_router(auth_router)
app.include_router(chat_router)

# 导入数据库初始化函数
from services.database_service import init_db

# 初始化数据库
init_db()

# 根路由
@app.get("/")
async def root():
    return {"message": "Welcome to the backend API!"}

def run_server():
    """在独立线程中运行Uvicorn服务器"""
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=SERVER_PORT,
        workers=UVICORN_WORKERS,
        reload=False
    )
    server = uvicorn.Server(config)
    server.run()

if __name__ == "__main__":
    print(f"启动服务器，监听端口 {SERVER_PORT}，使用 {UVICORN_WORKERS} 个工作线程...")
    # 在独立线程中启动服务器
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # 主线程等待退出信号
    try:
        while server_running:
            threading.Event().wait(1)  # 等待1秒
    except KeyboardInterrupt:
        handle_shutdown(signal.SIGINT, None)