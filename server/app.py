# 请先安装所需依赖: pip install fastapi uvicorn openai sse-starlette
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import uvicorn
import asyncio

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

# 初始化OpenAI客户端
client = OpenAI(api_key="sk-lviyraktwurtkislovnzaortehpehojfibfioumhrqbmeqsj", base_url="https://api.siliconflow.cn/v1")

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    messages = data.get("messages", [])

    # 确保messages不为空且包含至少一条消息
    if not messages:
        return {"error": "No messages provided"}

    # 创建流式响应生成器
    async def generate():
        response = client.chat.completions.create(
            model="Qwen/Qwen2.5-Coder-7B-Instruct",
            messages=messages,
            stream=True
        )

        for chunk in response:
            if chunk.choices[0].delta.content is not None:
                # 以SSE格式发送数据
                yield f"data: {chunk.choices[0].delta.content}\n\n"
                # 短暂延迟，避免过快发送
                await asyncio.sleep(0.05)

        # 发送结束信号
        yield "data: [DONE]\n\n"

    # 返回流式响应
    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)