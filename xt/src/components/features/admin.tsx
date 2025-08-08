'use client'

import Link from "next/link";
import { useContext, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AuthContext } from '@/components/layout/Providers';
import { setNavWidth } from '@/store/NavSwitch';
import { usePathname } from 'next/navigation';

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
            dispatch(setNavWidth('0'));
        }
    };

    // 只在根目录显示
    if (pathname == '/login') {
        return null;
    }

    return (
        <>
        {authState ? (
            <div className="admin-button">
                <Link href="/admin" onClick={handleLinkClick}>管理员</Link>
            </div>
        ) : (
            <div className="admin-button">
                <Link href="/login" onClick={handleLinkClick}>登录</Link>
            </div>
        )}
        </>
    );
}