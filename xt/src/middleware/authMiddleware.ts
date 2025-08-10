import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 添加X-Frame-Options头以防止点击劫持
 * @param response - 要修改的响应对象
 * @returns 修改后的响应对象
 */
function addXFrameOptionsHeader(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

// 定义管理员页面路径和模式
const ADMIN_PAGE = '/admin';
const USER_ADMIN_PREFIX = '/admin/';
const ADMIN_ONLY_PATHS = ['/admin/users', '/admin/settings', '/admin/dashboard'];

// 缓存管理员状态，避免频繁请求
const adminStatusCache = new Map<string, { status: boolean, timestamp: number }>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟缓存过期时间

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
    const response = NextResponse.next();
    return addXFrameOptionsHeader(response);
  }

  // 所有非公共路径都需要认证
  if (!token || !sessionId) {
    // 未认证，重定向到登录页
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    return addXFrameOptionsHeader(redirectResponse);
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
    const redirectResponse = NextResponse.redirect(loginUrl);
    return addXFrameOptionsHeader(redirectResponse);
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

  // 检查是否为管理员（带缓存）
  const isAdmin = async () => {
    // 检查缓存
    const cacheKey = `${token}:${sessionId}`;
    const cached = adminStatusCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_EXPIRY_MS) {
      console.debug('使用缓存的管理员状态');
      return cached.status;
    }

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
        console.error('检查管理员权限失败，响应状态:', response.status);
        adminStatusCache.set(cacheKey, { status: false, timestamp: now });
        return false;
      }

      const data = await response.json();
      adminStatusCache.set(cacheKey, { status: data.is_admin, timestamp: now });
      return data.is_admin;
    } catch (error) {
      console.error('检查管理员权限异常:', error);
      adminStatusCache.set(cacheKey, { status: false, timestamp: now });
      return false;
    }
  };
 
  // 管理员页面访问控制
  if (isAdminPage) {
    const adminStatus = await isAdmin();
    if (!adminStatus) {
      console.warn('非管理员用户尝试访问管理员页面:', req.nextUrl.pathname);
      // 不是管理员，重定向到首页
      const redirectResponse = NextResponse.redirect(new URL('/', req.url));
      return addXFrameOptionsHeader(redirectResponse);
    }
  }

  // 特定管理员路径访问控制
  if (ADMIN_ONLY_PATHS.some(path => req.nextUrl.pathname.startsWith(path))) {
    const adminStatus = await isAdmin();
    if (!adminStatus) {
      console.warn('非管理员用户尝试访问管理员专属路径:', req.nextUrl.pathname);
      // 不是管理员，重定向到首页
      const redirectResponse = NextResponse.redirect(new URL('/', req.url));
      return addXFrameOptionsHeader(redirectResponse);
    }
  }

  // 个人后台页面访问控制
  if (isUserAdminPage && userId) {
    const currentUser = await getCurrentUserInfo();
    const adminStatus = await isAdmin();

    // 只有当前用户或管理员可以访问
      if (!currentUser || (currentUser.username !== userId && !adminStatus)) {
        const redirectResponse = NextResponse.redirect(new URL('/', req.url));
        return addXFrameOptionsHeader(redirectResponse);
      }
  }

  // 认证通过，继续请求
  const response = NextResponse.next();
  return addXFrameOptionsHeader(response);

}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}