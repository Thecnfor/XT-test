'use client'

import Link from "next/link";
import { useContext, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AuthContext } from '@/components/layout/Providers';
import { setNavWidth } from '@/store/NavSwitch';
import { usePathname } from 'next/navigation';
import { getCookie } from '@/lib/utils';

export default function AdminButton() {
    const pathname = usePathname();
    const { isAuthenticated } = useContext(AuthContext);
    const [authState, setAuthState] = useState(isAuthenticated);
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
    const dispatch = useDispatch();

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 监听认证状态变化
    useEffect(() => {
        setAuthState(isAuthenticated);
    }, [isAuthenticated]);

    const handleLinkClick = () => {
        // 只在屏幕宽度<=768px时执行
        if (screenWidth <= 768) {
            dispatch(setNavWidth('0px'));
        }
    };

    // 只在根目录显示
    if (pathname == '/login') {
        return null;
    }

    // 登出方法
    const handleLogout = () => {
        // 清除认证相关的cookie和localStorage
        document.cookie = 'username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        localStorage.removeItem('username');
        localStorage.removeItem('token');
        
        // 更新认证状态
        setAuthState(false);
        
        // 重定向到登录页
        window.location.href = '/login';
    };

    // 获取当前用户名（从cookie、localStorage或token中）
    const getCurrentUsername = () => {
        // 1. 尝试从cookie中获取
        const usernameFromCookie = getCookie('username');
        if (usernameFromCookie) {
            return usernameFromCookie;
        }
        
        // 2. 尝试从localStorage中获取
        const usernameFromLocalStorage = localStorage.getItem('username');
        if (usernameFromLocalStorage) {
            return usernameFromLocalStorage;
        }
        
        // 3. 尝试从token中解析 (假设token在localStorage中)
        const token = localStorage.getItem('token');
        if (token) {
            try {
                // 简单解析token (实际应用中可能需要更复杂的解析)
                const decodedToken = JSON.parse(atob(token.split('.')[1]));
                return decodedToken.username || decodedToken.name || 'unknown';
            } catch (error) {
                console.error('Failed to decode token:', error);
            }
        }
        
        // 所有方法都失败，调用登出并返回默认值
        handleLogout();
        return 'unknown';
    };

    return (
        <>        
        {authState ? (
            <div className="admin-button">
                <Link href={`/admin/${getCurrentUsername()}`} onClick={handleLinkClick}>管理员</Link>
            </div>
        ) : (
            <div className="admin-button">
                <Link href="/login" onClick={handleLinkClick}>登录</Link>
            </div>
        )}
        </>
    );
}