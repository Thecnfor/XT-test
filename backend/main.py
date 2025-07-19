from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from socketio import AsyncServer, ASGIApp
import uvicorn
from fastapi.responses import HTMLResponse

# 初始化FastAPI应用
app = FastAPI(title="Xrak 实时通信后端")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 允许前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化Socket.IO服务器
socketio = AsyncServer(cors_allowed_origins="http://localhost:3000", async_mode="asgi")

# 创建ASGI应用，将Socket.IO和FastAPI结合
socket_app = ASGIApp(socketio, app)

# 测试路由
@app.get("/")
async def read_root():
    return HTMLResponse("<h1>Xrak 实时通信后端服务运行中</h1>")

# Socket.IO事件处理
@socketio.event
async def connect(sid, environ):
    print(f"客户端连接: {sid}")
    await socketio.emit("message", f"新用户加入: {sid[:8]}...", room=sid)

@socketio.event
async def disconnect(sid):
    print(f"客户端断开连接: {sid}")

@socketio.event
async def message(sid, data):
    print(f"收到消息: {data} 来自 {sid}")
    # 广播消息给所有连接的客户端
    await socketio.emit("message", data, skip_sid=sid)

if __name__ == "__main__":
    uvicorn.run("main:socket_app", host="0.0.0.0", port=5000, reload=True)