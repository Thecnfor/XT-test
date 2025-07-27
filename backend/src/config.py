import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

class Config:
    # 服务器配置
    HTTP_PORT = int(os.getenv('HTTP_PORT', 8000))
    WS_PORT = int(os.getenv('WS_PORT', 8765))
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

    # API 配置
    API_TIMEOUT = int(os.getenv('API_TIMEOUT', 30))
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))

# 实例化配置对象，供其他模块导入使用
config = Config()