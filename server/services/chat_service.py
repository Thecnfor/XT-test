import openai
import asyncio
from config import OPENAI_API_KEY, OPENAI_BASE_URL
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
                model="Qwen/Qwen2.5-Coder-7B-Instruct",
                messages=[msg.dict() for msg in messages],
                stream=True
            )

            # 流式返回响应
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    # 流式输出每个字符，而不是整个块
                    for char in content:
                        yield f"data: {char}\n\n"
                        # 添加微小延迟，确保浏览器能及时处理
                        await asyncio.sleep(0.01)
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Chat service error: {str(e)}")
            raise e