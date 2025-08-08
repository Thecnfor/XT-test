'use client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import navReducer from '@/store/NavSwitch';
import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { APP_CONFIG } from '@/lib/config';

const store = configureStore({
  reducer: {
    nav: navReducer
  }
});

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
  const checkTimerRef = useRef<number | null>(null);

  // 更新token和会话ID的方法
  const setAuthToken = useCallback((newToken: string | null, newSessionId?: string) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
      if (newSessionId) {
        localStorage.setItem('sessionId', newSessionId);
        setSessionId(newSessionId);
      }
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('sessionId');
      setSessionId(null);
    }
    setToken(newToken);
  }, []);

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
    // 清除本地存储和状态
    localStorage.removeItem('token');
    localStorage.removeItem('sessionId');
    setToken(null);
    setSessionId(null);
  }, [sessionId]);

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
      console.error('刷新会话请求发生错误:', error);
      return false;
    }
  }, [sessionId]);

  // 检查会话是否即将过期
  const checkSessionExpiry = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch('http://localhost:8000/auth/check_session_expiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          warning_threshold: APP_CONFIG.session.expiryWarningThreshold
        }),
      });

      if (!response.ok) {
        console.error('检查会话过期请求失败:', response.statusText);
        return;
      }

      const data = await response.json();
      if (data.valid) {
        if (data.is_about_to_expire) {
          console.log(`会话即将过期，剩余${data.remaining_minutes.toFixed(1)}分钟，尝试刷新...`);
          const refreshSuccess = await refreshSession();
          if (!refreshSuccess) {
            console.error('刷新会话失败，即将登出');
            clearSession();
          }
        } else {
          console.log(`会话状态正常，剩余${data.remaining_minutes.toFixed(1)}分钟`);
        }
      } else {
        console.error('会话无效，即将登出');
        clearSession();
      }
    } catch (error) {
      console.error('检查会话过期请求发生错误:', error);
    }
  }, [sessionId, refreshSession, clearSession]);

  useEffect(() => {
    // 初始化时从本地存储获取令牌和会话ID
    const storedToken = localStorage.getItem('token');
    const storedSessionId = localStorage.getItem('sessionId');
    setToken(storedToken);
    setSessionId(storedSessionId);

    // 设置监听事件，当令牌或会话ID变化时更新状态
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('token');
      const newSessionId = localStorage.getItem('sessionId');
      setToken(newToken);
      setSessionId(newSessionId);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // 清除定时器
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, []);

  // 计算认证状态
  const isAuthenticated = !!token;

  // 设置定期检查会话状态的定时器
  useEffect(() => {
    if (isAuthenticated) {
      // 立即检查一次
      checkSessionExpiry();
      // 然后定期检查
      checkTimerRef.current = window.setInterval(checkSessionExpiry, APP_CONFIG.session.checkInterval);
    } else if (checkTimerRef.current) {
      // 如果未认证，清除定时器
      clearInterval(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    return () => {
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [isAuthenticated, checkSessionExpiry]);

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