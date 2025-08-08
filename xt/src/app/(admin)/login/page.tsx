'use client';
import { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/components/layout/Providers';


export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerError, setRegisterError] = useState('');
  const router = useRouter();
  const { setAuthToken } = useContext(AuthContext);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // 调用后端登录API - 使用application/x-www-form-urlencoded格式
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch('http://localhost:8000/auth/token', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '登录失败');
        return;
      }

      // 使用setAuthToken方法设置令牌和会话ID
      setAuthToken(data.access_token, data.session_id);

      // 登录成功，重定向到首页
      router.push('/admin');
    } catch (error) {
      setError('登录失败，请检查用户名和密码');
      console.error('登录请求失败:', error);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('两次输入的密码不一致');
      return;
    }

    try {
      // 发送注册请求到后端API
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerUsername,
          password: registerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegisterError(data.error || '注册失败');
        return;
      }

      setIsRegistering(false);
      setError('注册成功，请登录');
    } catch (error) {
      setRegisterError('注册失败，请稍后再试');
      console.error('注册请求失败:', error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {isRegistering ? (
          <>
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">注册</h2>
            {registerError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                {registerError}
              </div>
            )}
            <form onSubmit={handleRegisterSubmit}>
              <div className="mb-4">
                <label htmlFor="registerUsername" className="block mb-2 text-sm font-medium text-gray-700">
                  用户名
                </label>
                <input
                  type="text"
                  id="registerUsername"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="registerPassword" className="block mb-2 text-sm font-medium text-gray-700">
                  密码
                </label>
                <input
                  type="password"
                  id="registerPassword"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="registerConfirmPassword" className="block mb-2 text-sm font-medium text-gray-700">
                  确认密码
                </label>
                <input
                  type="password"
                  id="registerConfirmPassword"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                注册
              </button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsRegistering(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                已有账号？立即登录
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">登录</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}
            <form onSubmit={handleLoginSubmit}>
              <div className="mb-4">
                <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-700">
                  用户名
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
                  密码
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                登录
              </button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsRegistering(true)}
                className="text-blue-600 hover:text-blue-800"
              >
                还没有账号？立即注册
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}