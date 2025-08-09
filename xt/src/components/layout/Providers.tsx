'use client';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { APP_CONFIG } from '@/lib/config';
import { setCookie, getCookie, deleteCookie } from '@/lib/utils';
import { initializeBgFilter } from '@/store/NavSwitch';

// 使用与store/index.ts一致的配置
import store from '@/store';

// 创建认证上下文
export const AuthContext = createContext<{
  isAuthenticated: boolean;
  token: string | null;
  sessionId: string | null;
  setAuthToken: (token: string | null, sessionId?: string) => void;
  clearSession: () => void;
  refreshSession: () => Promise<boolean>;
}>({
  isAuthenticated: false,
  token: null,
  sessionId: null,
  setAuthToken: () => {},
  clearSession: () => {},
  refreshSession: async () => false
});

export default function Providers({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const checkTimerRef = useRef<number | null>(null);
  const pathname = usePathname();

  // 更新token和会话ID的方法
  const setAuthToken = useCallback((newToken: string | null, newSessionId?: string) => {
    if (newToken) {
      setCookie('token', newToken);
      if (newSessionId) {
        setCookie('sessionId', newSessionId);
        setSessionId(newSessionId);
      }
    } else {
      deleteCookie('token');
      deleteCookie('sessionId');
      setSessionId(null);
    }
    setToken(newToken);
    setIsAuthenticated(!!newToken);
  }, [setIsAuthenticated]);

  // 清除会话的方法
  const clearSession = useCallback(async () => {
    if (sessionId) {
      try {
        // 调用后端登出API
        await fetch('http://localhost:8000/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (error) {
        console.error('登出请求失败:', error);
      }
    }
    // 清除所有认证相关的Cookie
    deleteCookie('token');
      deleteCookie('sessionId');
      deleteCookie('username');
      deleteCookie('lastSessionCheck');
      deleteCookie('sessionExpiry');
    // 清除状态
    setToken(null);
    setSessionId(null);
    // 强制刷新页面，确保所有状态都被重置
    window.location.href = '/';
  }, [sessionId]);

  // 检查会话状态的方法
  const checkSessionStatus = useCallback(async (forceCheck = false) => {
    if (!sessionId) {
      return;
    }

    // 避免过于频繁的检查
    const now = Date.now();
    const lastCheck = Number(getCookie('lastSessionCheck') || '0');
    const minCheckInterval = APP_CONFIG.session.minCheckInterval; // 最小检查间隔

    if (!forceCheck && now - lastCheck < minCheckInterval) {
      return;
    }

    setCookie('lastSessionCheck', now.toString(), 1);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.session.checkTimeout); // 使用配置中的超时时间

      const response = await fetch('http://localhost:8000/auth/check_session_expiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // 仅在非401错误时清除会话，避免循环登出
        if (response.status !== 401) {
          await clearSession();
        }
        return;
      }

      const data = await response.json();
      if (!data.valid) {
        await clearSession();
      } else {
        // 会话有效，更新会话信息
        setCookie('sessionExpiry', (Date.now() + data.remaining_time * 1000).toString(), 1);
      }
    } catch (error) {
      // 网络错误时，尝试使用Cookie存储的过期时间
      const expiryTime = Number(getCookie('sessionExpiry') || '0');
      if (expiryTime && now > expiryTime) {
        await clearSession();
      } else if (error instanceof Error && error.name === 'AbortError') {
        console.warn('会话检查请求超时');
        // 超时不立即清除会话，避免误判
      } else {
        // 其他错误，保守处理
        await clearSession();
      }
    }
  }, [sessionId, clearSession]);

  // 刷新会话的方法
  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      console.error('没有会话ID，无法刷新会话');
      return false;
    }

    try {
      const response = await fetch('http://localhost:8000/auth/refresh_session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        console.error('刷新会话请求失败:', response.statusText);
        return false;
      }

      const data = await response.json();
      if (data.success) {
        console.log('会话已成功刷新，新过期时间:', data.new_expire_time);
        return true;
      } else {
        console.error('刷新会话失败:', data.message);
        return false;
      }
    } catch (error) {
      console.error('刷新会话发生异常:', error);
      return false;
    }
  }, [sessionId]);

  // 启动定时检查会话状态
  useEffect(() => {
    if (isAuthenticated) {
      // 立即检查一次
      checkSessionStatus();
      // 然后每5分钟检查一次
      checkTimerRef.current = window.setInterval(checkSessionStatus, APP_CONFIG.session.checkInterval); // 使用配置文件中的检查间隔

      // 添加窗口聚焦时的检查
      const handleFocus = () => {
        checkSessionStatus(true); // 强制检查
      };

      window.addEventListener('focus', handleFocus);

      // 清除事件监听
      return () => {
        if (checkTimerRef.current) {
          window.clearInterval(checkTimerRef.current);
          checkTimerRef.current = null;
        }
        window.removeEventListener('focus', handleFocus);
      };
    }

    // 清除定时器
    return () => {
      if (checkTimerRef.current) {
        window.clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [isAuthenticated, checkSessionStatus]);

  useEffect(() => {
    // 初始化时从Cookie获取令牌和会话ID
    const storedToken = getCookie('token');
    const storedSessionId = getCookie('sessionId');
    setToken(storedToken);
    setSessionId(storedSessionId);
    setIsAuthenticated(!!storedToken);

    // 初始化bg-filter
    store.dispatch(initializeBgFilter());

    // 清除函数
    return () => {
      // 清除定时器
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, []);

  // 当token变化时，更新认证状态
  useEffect(() => {
    setIsAuthenticated(!!token);
  }, [token]);

  // 路由变化时检查会话状态
  useEffect(() => {
    if (isAuthenticated) {
      checkSessionStatus(true); // 强制检查
    }
  }, [pathname, isAuthenticated, checkSessionStatus]);

  // 认证状态已通过useState管理，无需重复计算

  return (
    <Provider store={store}>
      <AuthContext.Provider 
        value={{ 
          isAuthenticated,
          token,
          sessionId,
          setAuthToken,
          clearSession,
          refreshSession
        }}>
        {children}
      </AuthContext.Provider>
    </Provider>
  );
}