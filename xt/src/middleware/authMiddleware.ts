import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// 定义管理员页面路径
const ADMIN_PAGE = '/admin';
// 定义个人后台路径前缀
const USER_ADMIN_PREFIX = '/admin/';

export async function authMiddleware(req: NextRequest) {
  // 从请求头获取token
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');

  // 获取cookies
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  // 公共路径不需要认证
  const publicPaths = ['/login', '/register', '/api/auth/register', '/api/auth/token'];
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 所有非公共路径都需要认证
  if (!token || !sessionId) {
    // 未认证，重定向到登录页
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 验证会话有效性
  async function validateSession() {
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
      return data.valid;
    } catch (error) {
      console.error('会话验证失败:', error);
      return false;
    }
  }

  const isValid = await validateSession();
  if (!isValid) {
    // 会话无效，清除cookie并重定向到登录页
    cookieStore.delete('sessionId');
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 检查是否是管理员页面或个人后台页面
  const isAdminPage = req.nextUrl.pathname === ADMIN_PAGE;
  const isUserAdminPage = req.nextUrl.pathname.startsWith(USER_ADMIN_PREFIX);
  let userId = null;

  if (isUserAdminPage) {
    // 提取userId
    const parts = req.nextUrl.pathname.split('/');
    if (parts.length >= 3) {
      userId = parts[2];
    }
  }

  // 获取当前用户信息
  const getCurrentUserInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/auth/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  };

  // 检查是否为管理员
  const isAdmin = async () => {
    try {
      const response = await fetch('http://localhost:8000/auth/is_admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: sessionId })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.is_admin;
    } catch (error) {
      console.error('检查管理员权限失败:', error);
      return false;
    }
  };

  // 管理员页面访问控制
  if (isAdminPage) {
    const adminStatus = await isAdmin();
    if (!adminStatus) {
      // 不是管理员，重定向到首页
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // 个人后台页面访问控制
  if (isUserAdminPage && userId) {
    const currentUser = await getCurrentUserInfo();
    const adminStatus = await isAdmin();

    // 只有当前用户或管理员可以访问
    if (!currentUser || (currentUser.username !== userId && !adminStatus)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // 认证通过，继续请求
  return NextResponse.next();

  // 删除了重复的无效代码
  // 这些代码在函数返回后定义，永远不会被执行

}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}