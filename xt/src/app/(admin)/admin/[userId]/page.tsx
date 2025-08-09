'use client'

import { useRouter, useParams } from 'next/navigation'
import { useContext } from 'react'
import { AuthContext } from '@/components/layout/Providers'

export default function UserAdminPage() {
  const router = useRouter()
  const { userId } = useParams()
  const { clearSession, isAuthenticated } = useContext(AuthContext)

  // 处理退出登录
  const handleLogout = async () => {
    await clearSession()
    router.push('/')
  }

  // 如果未认证，重定向到登录页
  if (!isAuthenticated) {
    router.push('/login')
    return null
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>个人后台</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>欢迎, {userId}</p>
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