# Please install OpenAI SDK first: `pip3 install openai`
from openai import OpenAI

# 修正base_url，移除末尾的/chat/completions
client = OpenAI(api_key="sk-lviyraktwurtkislovnzaortehpehojfibfioumhrqbmeqsj", base_url="https://api.siliconflow.cn/v1")

response = client.chat.completions.create(
    model="Qwen/Qwen2.5-Coder-7B-Instruct",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "你是什么"},
    ],
    stream=True
)

# 正确处理流式响应
generated_text = ""
for chunk in response:
    if chunk.choices[0].delta.content is not None:
        generated_text += chunk.choices[0].delta.content
        print(chunk.choices[0].delta.content, end="", flush=True)

print("\n完整响应:", generated_text)