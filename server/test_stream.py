import requests
import time

# 测试后端流式响应
url = 'http://localhost:8000/chat'
headers = {'Content-Type': 'application/json'}

data = {
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "请用流式输出方式，慢慢告诉我1到10这10个数字，每个数字单独一行。"}
    ]
}

print("发送请求到后端...")
response = requests.post(url, headers=headers, json=data, stream=True)

print(f"响应状态码: {response.status_code}")
print(f"响应头: {response.headers}")

if response.status_code == 200:
    print("开始接收流式响应...")
    for line in response.iter_lines():
        if line:
            # 解码字节为字符串
            decoded_line = line.decode('utf-8')
            print(f"收到: {decoded_line}")
            # 模拟处理延迟
            time.sleep(0.1)
else:
    print(f"请求失败: {response.text}")