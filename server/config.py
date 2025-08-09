# 配置文件

# OpenAI API 配置
OPENAI_API_KEY = "sk-lviyraktwurtkislovnzaortehpehojfibfioumhrqbmeqsj"
OPENAI_BASE_URL = "https://api.siliconflow.cn/v1"
AI_MODEL = "Qwen/Qwen2.5-Coder-7B-Instruct"

# 服务器配置
SERVER_PORT = 8000
# Uvicorn工作线程数量
UVICORN_WORKERS = 4
# 会话清理间隔（分钟）
SESSION_CLEANUP_INTERVAL_MINUTES = 1

# 认证配置
SECRET_KEY = "your-secret-key-here-change-in-production"
ALGORITHM = "HS256"
# bcrypt密码哈希工作因子
# 工作因子每增加1，哈希计算时间翻倍
BCRYPT_WORK_FACTOR = 14
ACCESS_TOKEN_EXPIRE_MINUTES = 15
# 密码传输加密密钥 - 必须与前端保持一致
ENCRYPTION_KEY = "your-encryption-key-here"  # 生产环境中应使用环境变量
SESSION_EXPIRE_MINUTES = 30
# 会话存储 - 使用JSON文件
SESSION_FILE = "d:/Xrak/XT-test/server/session.json"
# 会话不活动超时时间（分钟）
SESSION_INACTIVITY_TIMEOUT = 15

# 数据库配置
# 使用MySQL时取消注释以下配置
DATABASE_USER = "kalikali"
DATABASE_PASSWORD = "SqM3OdPqbjdXgtwM"
DATABASE_HOST_PORT = "mysql2.sqlpub.com:3307"
DATABASE_NAME = "kalikali"
# 数据库操作最大重试次数
DATABASE_MAX_RETRIES = 3

# 数据库类型：mysql 或 sqlite
DATABASE_TYPE = "sqlite"