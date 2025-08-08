'use client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import navReducer from '@/store/NavSwitch';
import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';

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
}>({
  isAuthenticated: false,
  token: null,
  sessionId: null,
  setAuthToken: () => {},
  clearSession: () => {}
});

export default function Providers({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

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
    };
  }, []);

  return (
    <Provider store={store}>
      <AuthContext.Provider 
        value={{ 
          isAuthenticated: !!token, 
          token, 
          sessionId, 
          setAuthToken, 
          clearSession 
        }}>
        {children}
      </AuthContext.Provider>
    </Provider>
  );
}