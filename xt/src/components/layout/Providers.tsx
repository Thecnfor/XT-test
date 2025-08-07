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
  setAuthToken: (token: string | null) => void;
}>({
  isAuthenticated: false,
  token: null,
  setAuthToken: () => {}
});

export default function Providers({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  // 更新token的方法
  const setAuthToken = useCallback((newToken: string | null) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
    } else {
      localStorage.removeItem('token');
    }
    setToken(newToken);
  }, []);

  useEffect(() => {
    // 初始化时从本地存储获取令牌
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);

    // 设置监听事件，当令牌变化时更新状态
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('token');
      setToken(newToken);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <Provider store={store}>
      <AuthContext.Provider value={{ isAuthenticated: !!token, token, setAuthToken }}>
        {children}
      </AuthContext.Provider>
    </Provider>
  );
}