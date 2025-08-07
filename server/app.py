from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from api.auth import router as auth_router
from api.chat import router as chat_router
from config import SERVER_PORT

# 创建FastAPI应用
app = FastAPI()

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

# 根路由
@app.get("/")
async def root():
    return {"message": "Welcome to the backend API!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT)