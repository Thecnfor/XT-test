'use client'

import Link from "next/link";
import { useContext } from 'react';
import { useDispatch } from 'react-redux';
import { AuthContext } from '@/components/layout/Providers';
import { setNavWidth } from '@/store/NavSwitch';
import { usePathname } from 'next/navigation';

export default function AdminButton() {
    const pathname = usePathname();
    // 确保在客户端执行
    const { isAuthenticated } = useContext(AuthContext);
    const dispatch = useDispatch();

    const handleLinkClick = () => {
        // 设置导航宽度为0
        dispatch(setNavWidth('0'));
    };

    // 只在根目录显示
    if (pathname == '/login') {
        return null;
    }

    return (
        <>
        {isAuthenticated ? (
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