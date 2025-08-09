'use client';
import { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/components/layout/Providers';
import CryptoJS from 'crypto-js';

// 加密密钥 - 实际应用中应从安全存储中获取
const ENCRYPTION_KEY = 'your-encryption-key-here'; // 生产环境中应使用环境变量


// 过滤特殊字符的函数
const sanitizeInput = (input: string): string => {
  // 移除所有HTML标签和危险字符
  return input
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/[&<>"'`;(){}[\]\/]/g, ''); // 移除特殊字符
};

// 验证输入是否安全
const isValidInput = (input: string): boolean => {
  // 检查是否包含危险字符或脚本
  const dangerousPatterns = [
    /<script.*?>.*?<\/script>/gi,
    /on[a-zA-Z]+\s*=/, // 事件处理器
    /javascript:/gi,
    /data:/gi
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
};

// 检查密码强度
const checkPasswordStrength = (password: string): { strength: 'weak' | 'medium' | 'strong'; message: string } => {
  // 至少8位，包含字母和数字
  if (password.length < 8) {
    return { strength: 'weak', message: '密码长度至少为8位' };
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { strength: 'weak', message: '密码必须包含字母和数字' };
  }
  // 包含特殊字符
  if (/[^A-Za-z0-9]/.test(password)) {
    return { strength: 'strong', message: '密码强度良好' };
  }
  return { strength: 'medium', message: '密码强度中等，可以添加特殊字符提高安全性' };
};

// 加密函数 - 与后端解密逻辑匹配
const encryptPassword = (password: string): string => {
  // 使用CryptoJS的PBKDF2密钥派生
  const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
  const salt = CryptoJS.lib.WordArray.random(8); // 8字节salt
  
  // 使用PBKDF2生成密钥和IV (与后端一致)
  // 注意：CryptoJS的PBKDF2默认使用1000次迭代，这里需要设置为1次以匹配后端
  const keyIV = CryptoJS.PBKDF2(key, salt, {
    keySize: (32 + 16) / 4, // 32字节密钥 + 16字节IV
    iterations: 1,
    hasher: CryptoJS.algo.SHA1
  });
  
  // 手动提取密钥和IV（不使用slice或splice方法）
  const encryptedKey = CryptoJS.lib.WordArray.create(keyIV.words.slice(0, 32 / 4)); // 32字节密钥
  const iv = CryptoJS.lib.WordArray.create(keyIV.words.slice(32 / 4)); // 16字节IV
  
  // 使用CBC模式和PKCS7填充加密
  const encrypted = CryptoJS.AES.encrypt(password, encryptedKey, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  // 组合salt和密文，格式: 'Salted__' + salt + ciphertext
  const saltedData = CryptoJS.enc.Utf8.parse('Salted__')
    .concat(salt)
    .concat(encrypted.ciphertext);
  
  return saltedData.toString(CryptoJS.enc.Base64);
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{ strength: 'weak' | 'medium' | 'strong'; message: string } | null>(null);
  const [registerPasswordStrength, setRegisterPasswordStrength] = useState<{ strength: 'weak' | 'medium' | 'strong'; message: string } | null>(null);
  const router = useRouter();
  const { setAuthToken } = useContext(AuthContext);

  // 密码强度检查处理
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = sanitizeInput(e.target.value);
    setPassword(value);
    if (value) {
      setPasswordStrength(checkPasswordStrength(value));
    } else {
      setPasswordStrength(null);
    }
  };

  const handleRegisterPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = sanitizeInput(e.target.value);
    setRegisterPassword(value);
    if (value) {
      setRegisterPasswordStrength(checkPasswordStrength(value));
    } else {
      setRegisterPasswordStrength(null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 过滤和验证输入
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedPassword = sanitizeInput(password);

    if (!isValidInput(sanitizedUsername) || !isValidInput(sanitizedPassword)) {
      setError('输入包含不安全字符，请重新输入');
      return;
    }

    try {
      // 加密密码
      const encryptedPassword = encryptPassword(sanitizedPassword);

      // 调用后端登录API - 使用JSON格式
      const response = await fetch('http://localhost:8000/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: sanitizedUsername,
          password: encryptedPassword,
        }),
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

    // 过滤和验证输入
    const sanitizedUsername = sanitizeInput(registerUsername);
    const sanitizedPassword = sanitizeInput(registerPassword);

    if (!isValidInput(sanitizedUsername) || !isValidInput(sanitizedPassword)) {
      setRegisterError('输入包含不安全字符，请重新输入');
      return;
    }

    try {
      // 检查密码强度
      const strength = checkPasswordStrength(sanitizedPassword);
      if (strength.strength === 'weak') {
        setRegisterError('密码强度不足: ' + strength.message);
        return;
      }

      // 加密密码
      const encryptedPassword = encryptPassword(sanitizedPassword);

      // 发送注册请求到后端API
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: sanitizedUsername,
          password: encryptedPassword,
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
                    onChange={handleRegisterPasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {registerPasswordStrength && (
                    <div className={`mt-2 text-sm ${registerPasswordStrength.strength === 'weak' ? 'text-red-600' : registerPasswordStrength.strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {registerPasswordStrength.message}
                    </div>
                  )}
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
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {passwordStrength && (
                    <div className={`mt-2 text-sm ${passwordStrength.strength === 'weak' ? 'text-red-600' : passwordStrength.strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {passwordStrength.message}
                    </div>
                  )}
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