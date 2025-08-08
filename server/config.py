# 配置文件

# OpenAI API 配置
OPENAI_API_KEY = "sk-lviyraktwurtkislovnzaortehpehojfibfioumhrqbmeqsj"
OPENAI_BASE_URL = "https://api.siliconflow.cn/v1"
AI_MODEL = "Qwen/Qwen2.5-Coder-7B-Instruct"

# 服务器配置
SERVER_PORT = 8000
# Uvicorn工作线程数量
UVICORN_WORKERS = 4

# 认证配置
SECRET_KEY = "your-secret-key-here-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
SESSION_EXPIRE_MINUTES = 30

# 数据库配置
# 使用MySQL时取消注释以下配置
DATABASE_USER = "kalikali"
DATABASE_PASSWORD = "SqM3OdPqbjdXgtwM"
DATABASE_HOST_PORT = "mysql2.sqlpub.com:3307"
DATABASE_NAME = "kalikali"

# 数据库类型：mysql 或 sqlite
DATABASE_TYPE = "sqlite"