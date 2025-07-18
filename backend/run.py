from xt import create_app, socketio
import os

# 创建应用
app = create_app(os.getenv('FLASK_CONFIG') or 'default')

if __name__ == '__main__':
    # 运行应用
    socketio.run(app, debug=app.config['DEBUG'], host='0.0.0.0', port=5000)