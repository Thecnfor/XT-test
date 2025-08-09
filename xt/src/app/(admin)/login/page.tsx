'use client';
import  { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/components/layout/Providers';
import CryptoJS from 'crypto-js';
import { APP_CONFIG } from '@/lib/config';
import React from 'react';
import { getCookie } from '@/lib/utils';
import { useEffect } from 'react';
import styled from 'styled-components';


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
  const key = CryptoJS.enc.Utf8.parse(APP_CONFIG.security.encryptionKey);
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

// 主登录页面组件
const LoginPage = () => {
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
  const { isAuthenticated, setAuthToken } = useContext(AuthContext);
  const usernameFromCookie = getCookie('username');

  // 检查是否已登录，如果已登录则重定向到后台
  useEffect(() => {
    if (isAuthenticated && usernameFromCookie) {
      router.push(`/admin/${usernameFromCookie}`);
    }
  }, [isAuthenticated, router, usernameFromCookie]);

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

      // 设置用户名cookie
      document.cookie = `username=${sanitizedUsername}; path=/; max-age=3600`;

      // 登录成功，根据redirect参数决定重定向页面
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect') || `/admin/${sanitizedUsername}`;
      router.push(redirectUrl);
    } catch (error) {
      setError('登录失败，请检查用户名和密码');
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
    }
  };

  return (
    <StyledWrapper>
      <div className="container">
        <div className="card">
          <h2 className="login">{isRegistering ? '注册' : '登录'}</h2>
          {isRegistering ? (
            <div className="form-container">
              {registerError && (
                <div className="error-message">
                  {registerError}
                </div>
              )}
              <form onSubmit={handleRegisterSubmit} className="form">
                <div className="inputBox">
                  <input
                    type="text"
                    id="registerUsername"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                  />
                  <span className="user">用户名</span>
                </div>
                <div className="inputBox">
                  <input
                    type="password"
                    id="registerPassword"
                    value={registerPassword}
                    onChange={handleRegisterPasswordChange}
                    required
                  />
                  <span>密码</span>
                </div>
                {registerPasswordStrength && (
                  <div className="password-strength">
                    {registerPasswordStrength.message}
                  </div>
                )}
                <div className="inputBox">
                  <input
                    type="password"
                    id="registerConfirmPassword"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    required
                  />
                  <span>确认密码</span>
                </div>
                <button className="enter" type="submit">
                  注册
                </button>
              </form>
              <button
                className="switch-form"
                onClick={() => setIsRegistering(false)}
              >
                已有账号？立即登录
              </button>
            </div>
          ) : (
            <div className="form-container">
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              <form onSubmit={handleLoginSubmit} className="form">
                <div className="inputBox">
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <span className="user">用户名</span>
                </div>
                <div className="inputBox">
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                  />
                  <span>密码</span>
                </div>
                {passwordStrength && (
                  <div className="password-strength">
                    {passwordStrength.message}
                  </div>
                )}
                <button className="enter" type="submit">
                  登录
                </button>
              </form>
              <button
                className="switch-form"
                onClick={() => setIsRegistering(true)}
              >
                还没有账号？立即注册
              </button>
            </div>
          )}
        </div>
      </div>
    </StyledWrapper>
  );
}


// 导出登录页面组件
export default LoginPage;

const StyledWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  padding: 40px 0;

  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 64px;
    margin-right: var(--nav-width);
  }

  .login {
    color: var(--text-color);
    text-transform: uppercase;
    letter-spacing: 2px;
    display: block;
    font-weight: bold;
    font-size: x-large;
    margin-bottom: 20px;
  }

  .card {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    flex-direction: column;
    gap: 20px;
    background: var(--bg-color);
    padding: 30px;
  }

  .inputBox {
    position: relative;
    width: 100%;
    margin-bottom: 15px;
    border-bottom: 2px solid var(--text-color);
    border-left: 2px solid var(--text-color);
    border-bottom-left-radius: 8px;
  }

  .inputBox input {
    width: 100%;
    padding: 10px;
    outline: none;
    border: none;
    color: var(--text-color);
    font-size: 1em;
    background: transparent;
    transition: 0.1s;
  }

  .inputBox span {
    margin-top: 5px;
    position: absolute;
    left: 0;
    transform: translateY(-4px);
    margin-left: 10px;
    padding: 10px;
    pointer-events: none;
    font-size: 12px;
    color: var(--text-color);
    text-transform: uppercase;
    transition: 0.5s;
    letter-spacing: 3px;
    border-radius: 8px;
  }

  .inputBox input:valid~span,
  .inputBox input:focus~span {
    transform: translateX(148px) translateY(-15px);
    padding: 3px 9px;
    font-size: 0.9em;
    letter-spacing: 1px;
    background: var(--text-color);
    color: var(--bg-color);
    border: 1px solid var(--text-color);
  }

  .inputBox input:valid,
  .inputBox input:focus {
    border-radius: 8px;
  }

  .error-message {
    width: 100%;
    padding: 10px;
    margin-bottom: 15px;
    background-color: ;
    color: #d8000c;
    border: 1px solid #d8000c;
    border-radius: 4px;
    text-align: center;
    font-size: 14px;
  }

  .password-strength {
    width: 100%;
    padding: 5px 0;
    font-size: 12px;
    color: var(--text-color);
    margin-top: -10px;
    margin-bottom: 10px;
    text-align: center;
  }

  .form-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .enter {
    height: 45px;
    width: 120px;
    border-radius: 5px;
    cursor: pointer;
    color: var(--bg-color);
    background-color: var(--text-color);
    font-size: 18px;
    transition: 0.5s;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 15px auto;
    font-weight: bold;
  }

  .switch-form {
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    font-size: 14px;
    margin-top: 10px;
  }

  .enter:hover {
    border: 2px solid var(--text-color);
    background-color: var(--bg-color);
    color: var(--text-color);
  }`;
