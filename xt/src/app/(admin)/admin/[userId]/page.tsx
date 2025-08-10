'use client'

import { redirect, useParams } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '@/components/layout/Providers'
import { getCookie } from '@/lib/utils'

export default function UserAdminPage() {
  // 不再需要router对象
  const { userId } = useParams()
  const { clearSession, isAuthenticated } = useContext(AuthContext)
  const [username, setUsername] = useState('')

  useEffect(() => {
    // 从cookie获取用户名
    const cookieUsername = getCookie('username')
    if (cookieUsername) {
      setUsername(cookieUsername)
    }
  }, [])

  // 处理退出登录
  const handleLogout = async () => {
    await clearSession()
    // 不需要额外的重定向，因为clearSession方法内部已经有window.location.href = '/'的处理
  }
  
  // 如果未认证，重定向到登录页
  if (!isAuthenticated) {
    redirect('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>个人后台</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>欢迎, {username || userId}</p>
      <button
        onClick={handleLogout}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
      >
        退出登录
      </button>
    </div>
  );
}