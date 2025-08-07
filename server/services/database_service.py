import bcrypt
import os
import sqlite3
import pymysql
import bcrypt
from schemas.user import User
from config import DATABASE_TYPE, DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST_PORT, DATABASE_NAME

# 数据库文件路径
DB_FILE = "users.db"

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
        # SQLite连接
        conn = sqlite3.connect(DB_FILE)
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

    # 如果没有用户，插入测试数据
    if count == 0:
        # 加密密码
        hashed_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
        if DATABASE_TYPE == "mysql":
            cursor.execute(
                "INSERT INTO users (username, password) VALUES (%s, %s)",
                ("admin", hashed_password.decode('utf-8'))
            )
        else:
            cursor.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                ("admin", hashed_password.decode('utf-8'))
            )

    # 提交更改并关闭连接
    conn.commit()
    conn.close()

# 添加新用户
def add_user(username: str, password: str) -> bool:
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
        conn.close()
        return True
    except (sqlite3.IntegrityError, pymysql.IntegrityError):
        # 用户名已存在
        return False
    except Exception as e:
        print(f"Error adding user: {e}")
        return False

# 验证用户凭据
def verify_user(username: str, password: str) -> bool:
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

        # 关闭连接
        conn.close()

        # 验证密码
        if result:
            hashed_password = result['password'] if DATABASE_TYPE == "mysql" else result[0]
            return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
        return False
    except Exception as e:
        print(f"Error verifying user: {e}")
        return False

# 获取用户信息
def get_user(username: str) -> User:
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

        # 关闭连接
        conn.close()

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

# 初始化数据库
init_db()