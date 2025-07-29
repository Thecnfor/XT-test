'use client'

import Link from "next/link";
export default function AdminButton() {
    return (
        <div className="admin-button">
            <Link href="/admin">登录</Link>
        </div>
    );
}