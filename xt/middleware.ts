import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function authMiddleware(req: NextRequest) {
  // 从请求头获取token
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  // 或者从cookie获取
  const cookieStore = cookies();
  const sessionId = (await cookieStore).get('sessionId')?.value;

  // 公共路径不需要认证
  const publicPaths = ['/login', '/register', '/api/auth/register', '/api/auth/token'];
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 检查认证状态
  if (!token || !sessionId) {
    // 未认证，重定向到登录页
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 验证会话有效性
  try {
    const response = await fetch('http://localhost:8000/auth/validate_session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ session_id: sessionId })
    });

    const data = await response.json();
    if (!data.valid) {
      // 会话无效，清除本地存储并重定向到登录页
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    // 错误处理，重定向到登录页
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // 认证通过，继续请求
  return NextResponse.next();
}

// 导出中间件配置
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}