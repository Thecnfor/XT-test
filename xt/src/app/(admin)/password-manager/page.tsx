'use client';
import React, { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/components/layout/Providers';
import PasswordManager from '@/components/PasswordManager';
import { getCookie } from '@/lib/utils';
import styled from 'styled-components';

const PageWrapper = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`;

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 30px;
  color: white;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  opacity: 0.9;
  margin-bottom: 20px;
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
  }
`;

const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  color: white;
  font-size: 1.2rem;
`;

const ErrorWrapper = styled.div`
  background: rgba(231, 76, 60, 0.9);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  margin: 20px 0;
  backdrop-filter: blur(10px);
`;

const PasswordManagerPage: React.FC = () => {
  const { isAuthenticated, token } = useContext(AuthContext);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const usernameFromCookie = getCookie('username');

  useEffect(() => {
    // 检查认证状态
    const checkAuth = async () => {
      try {
        if (!isAuthenticated || !token) {
          // 未认证，重定向到登录页面
          router.push('/login?redirect=/password-manager');
          return;
        }
        
        // 验证token是否有效
        const response = await fetch('http://localhost:8000/auth/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('认证失败');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('认证检查失败:', error);
        setError('认证失败，请重新登录');
        setTimeout(() => {
          router.push('/login?redirect=/password-manager');
        }, 2000);
      }
    };

    checkAuth();
  }, [isAuthenticated, token, router]);

  const handleGoBack = () => {
    if (usernameFromCookie) {
      router.push(`/admin/${usernameFromCookie}`);
    } else {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <LoadingWrapper>
          <div>正在验证身份...</div>
        </LoadingWrapper>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <Container>
          <ErrorWrapper>
            <h3>访问错误</h3>
            <p>{error}</p>
            <p>正在重定向到登录页面...</p>
          </ErrorWrapper>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <Container>
        <Header>
          <Title>密码管理中心</Title>
          <Subtitle>
            安全的密码管理工具，帮助您创建、测试和管理密码
          </Subtitle>
          <BackButton onClick={handleGoBack}>
            ← 返回管理后台
          </BackButton>
        </Header>
        
        <PasswordManager token={token || undefined} />
        
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
            💡 提示：所有密码操作都经过加密处理，确保您的数据安全
          </p>
        </div>
      </Container>
    </PageWrapper>
  );
};

export default PasswordManagerPage;