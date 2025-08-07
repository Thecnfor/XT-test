import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

// 定义注册请求的数据结构
interface RegisterRequest {
  username: string;
  password: string;
}

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

    // 获取配置文件路径
    const configPath = path.join(process.cwd(), 'src', 'lib', 'config.json');

    // 读取配置文件
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // 检查用户是否已存在
    const userExists = config.users.some((user: any) => user.username === username);
    if (userExists) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 400 }
      );
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 添加新用户
    config.users.push({
      username,
      password: hashedPassword,
    });

    // 保存更新后的配置
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

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