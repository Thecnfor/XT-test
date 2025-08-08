import bcrypt
import os
import sqlite3
import pymysql
import bcrypt
from schemas.user import User
from config import DATABASE_TYPE, DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST_PORT, DATABASE_NAME

# 数据库文件路径
DB_FILE = "server/db/users.db"

# 确保数据库目录存在
os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)

# 数据库连接函数
def get_db_connection():
    if DATABASE_TYPE == "mysql":
        # MySQL连接
        conn = pymysql.connect(
            host=DATABASE_HOST_PORT.split(':')[0],
            port=int(DATABASE_HOST_PORT.split(':')[1]),
            user=DATABASE_USER,
            password=DATABASE_PASSWORD,
            database=DATABASE_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )
        return conn
    else:
        # SQLite连接 - 添加timeout参数防止数据库锁定
        conn = sqlite3.connect(DB_FILE, timeout=10)
        conn.row_factory = sqlite3.Row  # 使结果可以通过列名访问
        return conn

def init_db():
    # 连接数据库
    conn = get_db_connection()
    cursor = conn.cursor()

    # 创建用户表（如果不存在）
    if DATABASE_TYPE == "mysql":
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        )
        ''')
    else:
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
        ''')

    # 检查是否有用户
    cursor.execute("SELECT COUNT(*) as count FROM users")
    result = cursor.fetchone()
    count = result['count'] if DATABASE_TYPE == "mysql" else result[0]

    pass

    # 提交更改并关闭连接
    conn.commit()
    conn.close()

# 添加新用户
def add_user(username: str, password: str) -> bool:
    conn = None
    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            # 加密密码
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

            # 连接数据库
            conn = get_db_connection()
            cursor = conn.cursor()

            # 插入用户
            if DATABASE_TYPE == "mysql":
                cursor.execute(
                    "INSERT INTO users (username, password) VALUES (%s, %s)",
                    (username, hashed_password.decode('utf-8'))
                )
            else:
                cursor.execute(
                    "INSERT INTO users (username, password) VALUES (?, ?)",
                    (username, hashed_password.decode('utf-8'))
                )

            # 提交更改
            conn.commit()
            return True
        except (sqlite3.IntegrityError, pymysql.IntegrityError):
            # 用户名已存在
            return False
        except sqlite3.OperationalError as e:
            if 'database is locked' in str(e) and retry_count < max_retries - 1:
                retry_count += 1
                print(f"Database locked, retrying ({retry_count}/{max_retries})...")
                import time
                time.sleep(0.5)  # 等待0.5秒后重试
            else:
                print(f"Error adding user: {e}")
                return False
        except Exception as e:
            print(f"Error adding user: {e}")
            return False
        finally:
            # 确保连接始终被关闭
            if conn:
                conn.close()

    # 达到最大重试次数
    print("Max retries reached, failed to add user.")
    return False

# 验证用户凭据
def verify_user(username: str, password: str) -> bool:
    conn = None
    try:
        # 连接数据库
        conn = get_db_connection()
        cursor = conn.cursor()

        # 查询用户
        if DATABASE_TYPE == "mysql":
            cursor.execute(
                "SELECT password FROM users WHERE username = %s",
                (username,)
            )
        else:
            cursor.execute(
                "SELECT password FROM users WHERE username = ?",
                (username,)
            )
        result = cursor.fetchone()

        # 验证密码
        if result:
            hashed_password = result['password'] if DATABASE_TYPE == "mysql" else result[0]
            return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
        return False
    except Exception as e:
        print(f"Error verifying user: {e}")
        return False
    finally:
        # 确保连接始终被关闭
        if conn:
            conn.close()

# 获取用户信息
def get_user(username: str) -> User:
    conn = None
    try:
        # 连接数据库
        conn = get_db_connection()
        cursor = conn.cursor()

        # 查询用户
        if DATABASE_TYPE == "mysql":
            cursor.execute(
                "SELECT id, username, password FROM users WHERE username = %s",
                (username,)
            )
        else:
            cursor.execute(
                "SELECT id, username, password FROM users WHERE username = ?",
                (username,)
            )
        result = cursor.fetchone()

        # 处理查询结果
        if result:
            if DATABASE_TYPE == "mysql":
                return User(
                    id=result['id'],
                    username=result['username'],
                    password=result['password']
                )
            else:
                return User(
                    id=result[0],
                    username=result[1],
                    password=result[2]
                )
        return None
    except Exception as e:
        print(f"Error getting user: {e}")
        return None
    finally:
        # 确保连接始终被关闭
        if conn:
            conn.close()

# 初始化数据库
init_db()