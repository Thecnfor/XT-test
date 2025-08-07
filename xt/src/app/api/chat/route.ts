import { NextRequest, NextResponse } from 'next/server';

// 定义请求类型
interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Received chat request');
    // 获取请求体
    const body: ChatRequest = await request.json();
    console.log('Request body:', body);

    // 准备转发到后端服务器的请求
    const backendUrl = 'http://localhost:8000/chat';
    console.log(`Forwarding request to ${backendUrl}`);

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

    console.log(`Backend response status: ${response.status}`);
    console.log('Backend response headers:', Object.fromEntries(response.headers));

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error response: ${errorText}`);
      throw new Error(`Backend request failed with status: ${response.status}, error: ${errorText}`);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    console.log(`Content type: ${contentType}`);

    if (contentType?.includes('text/event-stream')) {
      console.log('Handling streaming response');
      // 处理流式响应
      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            console.error('No response body reader');
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('Streaming done');
                break;
              }
              console.log(`Received chunk: ${value.length} bytes`);
              controller.enqueue(value);
            }
          } catch (error) {
            console.error('Error reading stream:', error);
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
      console.log('Handling JSON response');
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