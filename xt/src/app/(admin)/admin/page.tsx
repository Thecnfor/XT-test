'use client'

import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { AuthContext } from '@/components/layout/Providers'

export default function Admin() {
  const router = useRouter()
  const { setAuthToken } = useContext(AuthContext)

  // 直接定义handleLogout函数
  const handleLogout = () => {
    // 使用setAuthToken方法清除token
    setAuthToken(null)
    // 重定向到登录页面
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>管理后台</h1>
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