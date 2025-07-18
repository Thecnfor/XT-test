class Config:
    """基础配置类"""
    SECRET_KEY = 'dev_key_for_xrak'
    DEBUG = True


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True


class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    # 生产环境中应使用环境变量设置密钥
    # SECRET_KEY = os.environ.get('SECRET_KEY')


# 配置映射，可根据环境变量选择不同配置
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}