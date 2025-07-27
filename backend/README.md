# 后端项目

## 项目结构

```
backend/
├── .gitignore
├── .venv/
├── pyproject.toml
├── requirements.txt
├── README.md
├── src/
│   ├── __init__.py
│   ├── app.py              # 应用入口
│   ├── config.py           # 配置文件
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py       # 路由配置
│   │   └── handlers.py     # 请求处理器
│   ├── services/
│   │   ├── __init__.py
│   │   └── dialogue_service.py  # 对话服务
│   └── utils/
│       ├── __init__.py
│       └── http_utils.py   # HTTP工具类
├── tests/
│   └── test_app.py         # 测试文件
├── docs/
└── scripts/
    └── start.bat          # 启动脚本
```

## 功能说明

- `app.py`: 应用入口，创建和配置aiohttp应用
- `config.py`: 配置文件，包含服务器端口、调试模式等设置
- `api/routes.py`: 路由配置，定义HTTP和WebSocket端点
- `api/handlers.py`: 请求处理器，处理HTTP和WebSocket请求
- `services/dialogue_service.py`: 对话服务，实现对话处理逻辑
- `utils/http_utils.py`: HTTP工具类，封装HTTP请求相关功能
- `tests/test_app.py`: 测试文件，包含HTTP和WebSocket端点的测试

## 环境要求

- Python 3.8+
- 依赖包：见 `requirements.txt`

## 运行方法

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 运行服务器：
```bash
cd scripts
start.bat
```

## 配置说明

配置项可以在 `config.py` 中修改，主要包括：
- `HTTP_PORT`: HTTP服务器端口
- `DEBUG`: 是否启用调试模式
- `API_TIMEOUT`: API请求超时时间
- `MAX_RETRIES`: API请求最大重试次数

## 设计优势

1. **模块化结构**：将代码分为api、services和utils模块，职责清晰
2. **统一入口**：使用aiohttp统一处理HTTP和WebSocket请求
3. **依赖注入**：通过应用实例共享服务，便于测试和维护
4. **错误处理**：完善的错误处理和日志记录
5. **类型提示**：使用类型提示提高代码可读性和可维护性
6. **测试支持**：提供测试文件，便于验证功能