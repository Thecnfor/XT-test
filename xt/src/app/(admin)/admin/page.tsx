'use client'

import { useRouter } from 'next/navigation'
import { useContext, useEffect } from 'react'
import { AuthContext } from '@/components/layout/Providers'

export default function Admin() {
  const router = useRouter()
  const { clearSession, isAuthenticated } = useContext(AuthContext)

  // 检查登录状态，未登录则重定向到登录页
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/admin')
    }
  }, [isAuthenticated, router])

  // 定义handleLogout函数
  const handleLogout = async () => {
    if (isAuthenticated) {
      // 只有已登录用户才能执行退出操作
      await clearSession()
      // 重定向到登录页面
      router.push('/login')
    }
  }

  // 未登录状态下不渲染内容
  if (!isAuthenticated) {
    return null
  }

  // 已登录用户显示管理页面
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