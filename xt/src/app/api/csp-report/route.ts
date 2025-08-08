import { NextRequest, NextResponse } from 'next/server';

// CSP报告处理程序
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    // 在生产环境中，记录CSP违规报告
    try {
      const report = await req.json();
      console.log('CSP Violation Report:', report);
      
      // 在实际应用中，你可能想要将报告存储在数据库中
      // 或者发送到日志服务
      
      return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
      console.error('Error processing CSP report:', error);
      return NextResponse.json({ error: 'Failed to process report' }, { status: 500 });
    }
  } else {
    // 在开发环境中，简单地返回成功
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

// 处理GET请求
export function GET() {
  return NextResponse.json({ message: 'CSP report endpoint' }, { status: 200 });
}