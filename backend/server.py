import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# 模拟数据库（实际应用中需使用真实数据库）1
DATABASE_FILE = "users.txt"


class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):

    def _set_headers(self, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")  # 允许所有跨域请求
        self.end_headers()

    def do_OPTIONS(self):
        # 处理预检请求
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)

        try:
            # 解析 JSON 数据
            data = json.loads(post_data.decode("utf-8"))
            username = data.get("username")
            password = data.get("password")

            if not username or not password:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "缺少用户名或密码"}).encode())
                return

            # 检查用户是否存在
            if self._user_exists(username):
                self._set_headers(409)
                self.wfile.write(json.dumps({"error": "用户名已存在"}).encode())
                return

            # 保存用户信息
            self._save_user(username, password)
            self._set_headers(201)
            self.wfile.write(json.dumps({"message": "用户注册成功", "user": username}).encode())

        except json.JSONDecodeError:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "无效的JSON格式"}).encode())

    def _user_exists(self, username):
        try:
            with open(DATABASE_FILE, "r") as f:
                for line in f:
                    if line.startswith(username + ":"):
                        return True
            return False
        except FileNotFoundError:
            return False

    def _save_user(self, username, password):
        with open(DATABASE_FILE, "a") as f:
            f.write(f"{username}:{password}\n")


def run(server_class=HTTPServer, handler_class=SimpleHTTPRequestHandler, port=8000):
    server_address = ("", port)
    httpd = server_class(server_address, handler_class)
    print(f"服务器运行在 http://localhost:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    run()