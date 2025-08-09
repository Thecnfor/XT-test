import { NextRequest, NextResponse } from 'next/server';

import { NextRequest, NextResponse } from 'next/server';

// 定义注册请求的数据结构
interface RegisterRequest {
  username: string;
  password: string;
}

// 导入加密库
import CryptoJS from 'crypto-js';

// 加密密钥 - 必须与前端和后端保持一致
const ENCRYPTION_KEY = 'your-encryption-key-here'; // 生产环境中应使用环境变量

// 加密函数
const encryptPassword = (password: string): string => {
  return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
};

export async function POST(req: NextRequest) {
  try {
    // 解析请求体
    const body: RegisterRequest = await req.json();
    const { username, password } = body;

    // 验证输入
    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码都是必填项' },
        { status: 400 }
      );
    }

    // 加密密码
    const encryptedPassword = encryptPassword(password);

    // 转发请求到后端API
    const response = await fetch('http://localhost:8000/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password: encryptedPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || '注册失败' },
        { status: response.status }
      );
    }

    // 返回成功响应
    return NextResponse.json({
      message: '注册成功',
      username,
    });
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json(
      { error: '注册失败，请稍后再试' },
      { status: 500 }
    );
  }
}