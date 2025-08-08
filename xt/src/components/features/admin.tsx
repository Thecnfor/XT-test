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
    const dispatch = useDispatch();

    // 监听认证状态变化
    useEffect(() => {
        setAuthState(isAuthenticated);
    }, [isAuthenticated]);

    const handleLinkClick = () => {
        dispatch(setNavWidth('0'));
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