from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from schemas.chat import ChatRequest
from services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])
chat_service = ChatService()

@router.post("")
async def chat(request: Request):
    try:
        data = await request.json()
        # 使用Pydantic模型验证请求数据
        chat_request = ChatRequest(**data)
        messages = chat_request.messages

        # 确保messages不为空
        if not messages:
            raise HTTPException(status_code=400, detail="No messages provided")

        # 返回流式响应
        return StreamingResponse(
            chat_service.generate_chat_response(messages),
            media_type="text/event-stream"
        )
    except Exception as e:
        print(f"Chat API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")