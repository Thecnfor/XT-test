# Xrak 后端 (FastAPI)

这是Xrak实时通信应用的后端部分，使用FastAPI和Socket.IO构建。

## 技术栈
- FastAPI: 高性能的Python Web框架
- Uvicorn: ASGI服务器
- Socket.IO: 实时通信
- Pydantic: 数据验证和设置管理

## 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 运行应用

```bash
# 直接运行（测试方法）
python main.py
```

### 3. 访问应用

打开浏览器，访问 http://localhost:5000

## 项目结构
```
backend/
├── .gitignore
├── main.py           # 应用入口
├── README.md         # 项目说明
├── requirements.txt  # 依赖列表
├── start.bat         # Windows启动脚本

```

## 功能
- 实时消息通信
- 客户端连接/断开事件处理
- 消息广播给所有客户端

## 配置
可以通过修改`main.py`文件或设置环境变量来配置应用。

## 部署
### 生产环境
```bash
# 使用Gunicorn作为ASGI服务器
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```