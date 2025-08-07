'use client'

import Link from "next/link";
export default function AdminButton() {
    return (
        <>
        <div className="admin-button">
            <Link href="/login">登录</Link>
        </div>
        <div className="admin-button">
            <Link href="/admin">管理员</Link>
        </div>
        </>
    );
}