import { NextRequest, NextResponse } from 'next/server';

// 定义请求类型
interface ChatRequest {
  messages: Array<{ id: string; content: string; sender: string; timestamp: number }>;
}

export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body: ChatRequest = await request.json();

    // 准备转发到后端服务器的请求
    const backendUrl = 'http://localhost:8000/chat';
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: body.messages }),
    });

    // 检查响应状态
    if (!response.ok) {
      throw new Error(`Backend request failed with status: ${response.status}`);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      // 处理流式响应
      new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      });

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 处理普通JSON响应
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}