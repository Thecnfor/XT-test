# 后端服务说明

## 项目结构

```
backend/
├── .gitignore
├── .venv/
├── README.md
├── pyproject.toml
├── requirements.txt
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── main.py
│   ├── server.py
│   └── user.py
├── tests/
├── docs/    这里放用户数据了
└── scripts/
```

## 功能说明

- `src/config.py`: 配置文件，加载环境变量
- `src/main.py`: WebSocket 服务器实现
- `src/server.py`: HTTP 服务器实现
- `src/user.py`: WebSocket 客户端示例

## 环境要求

- Python 3.8+
- 依赖包见 `requirements.txt`

## 运行方法

1. 安装依赖
```bash
pip install -r requirements.txt
```

2. 启动 HTTP 服务器
```bash
python -m src.server
```

3. 启动 WebSocket 服务器
```bash
python -m src.main
```

4. 运行 WebSocket 客户端示例
```bash
python -m src.user
```

## 配置说明

配置项在 `.env` 文件中设置，支持以下配置：

- `HTTP_PORT`: HTTP 服务器端口，默认 8000
- `WS_PORT`: WebSocket 服务器端口，默认 8765
- `DEBUG`: 是否开启调试模式，默认 False
- `API_TIMEOUT`: API 请求超时时间，默认 30 秒
- `MAX_RETRIES`: API 最大重试次数，默认 3 次