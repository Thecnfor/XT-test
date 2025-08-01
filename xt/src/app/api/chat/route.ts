import { NextRequest, NextResponse } from 'next/server';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequest = {
  input: string;
  history?: Message[];
  stream?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body: ChatRequest = await request.json();

    // 验证输入参数
    if (!body || typeof body.input !== 'string' || body.input.trim() === '') {
      return NextResponse.json(
        { error: '请提供有效的input参数' },
        { status: 400 }
      );
    }

    // 准备转发到Python后端的请求数据
    const pythonBackendUrl = 'http://localhost:5000/api/chat';
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: body.input,
        history: body.history || [],
        stream: body.stream || false,
      }),
    };

    console.log('转发请求到Python后端:', pythonBackendUrl);

    // 发送请求到Python后端
    const response = await fetch(pythonBackendUrl, requestOptions);

    // 检查响应状态
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || `Python后端请求失败: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // 获取响应数据
    const data = await response.json();

    console.log('Python后端响应成功');

    // 返回响应给客户端
    return NextResponse.json(data);
  } catch (error) {
    console.error('API处理异常:', error);
    return NextResponse.json(
      { error: `服务器内部错误: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}