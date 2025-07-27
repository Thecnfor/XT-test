from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from .config import config

# 模拟对话逻辑（实际可对接 AI 接口，这里先写死回复）
def handle_dialogue(request_data):
    user_input = request_data.get("message", "Hello")
    # 简单模拟回复，实际可替换成调用 AI 接口（如 OpenAI）
    return {
        "reply": f"你说：{user_input}，这是后端模拟的回复～"
    }

class MyHandler(BaseHTTPRequestHandler):
    # 解决跨域问题（前端和后端端口不同时需要）
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    # 处理 OPTIONS 请求（预检请求）
    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    # 处理 POST 请求（前端发对话内容到这里）
    def do_POST(self):
        if self.path == "/dialogue":
            # 1. 解析前端发的 JSON 数据
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length).decode("utf-8")
            request_data = json.loads(post_data)

            # 2. 处理对话逻辑
            response_data = handle_dialogue(request_data)

            # 3. 返回响应
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write('<!DOCTYPE html><html><body><h1>服务器正常运行</h1></body></html>'.encode('utf-8'))

if __name__ == "__main__":
    # 启动服务，端口 8000（可修改，注意和前端保持一致）
    server_address = ('', config.HTTP_PORT)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"后端服务启动：http://localhost:{config.HTTP_PORT}")
    httpd.serve_forever()