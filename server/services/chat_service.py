import openai
import asyncio
from config import OPENAI_API_KEY, OPENAI_BASE_URL, AI_MODEL
from schemas.chat import Message

class ChatService:
    def __init__(self):
        # 初始化OpenAI客户端
        self.client = openai.OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )

    async def generate_chat_response(self, messages: list[Message]):
        try:
            # 调用Qwen模型生成响应
            response = self.client.chat.completions.create(
                model=AI_MODEL,
                messages=[msg.dict() for msg in messages],
                stream=True
            )

            # 流式返回响应
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    # 按块输出数据
                    if content:
                        yield f"data: {content}\n\n"
                        # 添加适当延迟，确保浏览器能及时处理
                        await asyncio.sleep(0.02)
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"聊天服务罢工了，它可能需要一杯咖啡: {str(e)}")
            raise e