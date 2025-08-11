import { NextRequest, NextResponse } from 'next/server';

// 定义请求类型
interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
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
        // 转发原始请求头中的必要信息
        ...request.headers,
      },
      body: JSON.stringify(body),
      // 保持连接打开以支持流式响应
      keepalive: true,
    });


    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend request failed with status: ${response.status}, error: ${errorText}`);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('text/event-stream')) {
      // 处理流式响应
      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              controller.enqueue(value);
            }
          } catch {
            // 忽略错误
          } finally {
            controller.close();
          }
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
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}