import { cookies } from 'next/headers';
import AdminContent from './AdminContent';

export default async function Protected() {
  // 从cookie获取会话信息
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;
  const token = cookieStore.get('token')?.value;

  // 服务器端验证管理员权限
  let isAdminVerified = false;
  let error = null;

  if (!sessionId || !token) {
    error = '未找到会话信息';
  } else {
    try {
      const response = await fetch('http://localhost:8000/auth/is_admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: sessionId })
      });

      if (!response.ok) {
        throw new Error('服务器验证失败');
      }

      const data = await response.json();
      isAdminVerified = data.is_admin;
    } catch (err) {
      error = err instanceof Error ? err.message : '验证过程中发生错误';
    }
  }
    // 直接返回结果，不需要加载状态，因为是服务器组件
    if (error) {
      return <div className='error'>错误: {error}</div>;
    }

    return (
      <>
        {isAdminVerified ? (
          <div className='super-admin'>
            <h1>超级管理员</h1>
            <AdminContent isAdminVerified={isAdminVerified} />
        </div>
      ) : (
        <div className='none-admin'>
          <h1>没有管理员权限</h1>
        </div>
      )}
    </>
  )
}