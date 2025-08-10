'use client';
import React, { useState } from 'react';
import styled from 'styled-components';
import {
  checkPasswordStrength,
  validatePasswordStrengthAPI,
  generateSecurePassword,
  requestPasswordReset,
  resetPassword,
  changePassword,
  getPasswordStrengthColor,
  getPasswordStrengthWidth,
  sanitizeInput,
  isValidInput,
  type PasswordStrengthResult,
  type SecurePasswordResponse
} from '@/lib/password-utils';

// 样式组件
const PasswordManagerWrapper = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
`;

const Section = styled.div`
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  background: #f8f9fa;
`;

const SectionTitle = styled.h3`
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
`;

const InputGroup = styled.div`
  margin-bottom: 15px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 5px;
  color: #34495e;
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #3498db;
  }
  
  &.error {
    border-color: #e74c3c;
  }
`;

const Button = styled.button`
  padding: 12px 24px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  margin-bottom: 10px;
  
  &:hover {
    background: #2980b9;
  }
  
  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }
  
  &.secondary {
    background: #95a5a6;
    
    &:hover {
      background: #7f8c8d;
    }
  }
  
  &.danger {
    background: #e74c3c;
    
    &:hover {
      background: #c0392b;
    }
  }
`;

const PasswordStrengthBar = styled.div<{ strength: string; width: number }>`
  width: 100%;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  margin: 8px 0;
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.width}%;
    background: ${props => props.strength};
    transition: width 0.3s ease, background-color 0.3s ease;
  }
`;

const PasswordStrengthText = styled.div<{ color: string }>`
  font-size: 12px;
  color: ${props => props.color};
  font-weight: 500;
  margin-bottom: 5px;
`;

const IssuesList = styled.ul`
  margin: 8px 0;
  padding-left: 20px;
  font-size: 12px;
  color: #e74c3c;
`;

const SuggestionsList = styled.ul`
  margin: 8px 0;
  padding-left: 20px;
  font-size: 12px;
  color: #f39c12;
`;

const Message = styled.div<{ type: 'success' | 'error' | 'info' }>`
  padding: 12px;
  border-radius: 6px;
  margin: 10px 0;
  font-size: 14px;
  
  ${props => {
    switch (props.type) {
      case 'success':
        return 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;';
      case 'error':
        return 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;';
      case 'info':
        return 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;';
      default:
        return 'background: #f8f9fa; color: #495057; border: 1px solid #dee2e6;';
    }
  }}
`;

const GeneratedPasswordBox = styled.div`
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  padding: 15px;
  margin: 10px 0;
  font-family: 'Courier New', monospace;
  font-size: 16px;
  word-break: break-all;
  position: relative;
`;

const CopyButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 5px 10px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  
  &:hover {
    background: #5a6268;
  }
`;

// 组件属性接口
interface PasswordManagerProps {
  token?: string; // 用于需要认证的操作
}

// 密码管理器组件
const PasswordManager: React.FC<PasswordManagerProps> = ({ token }) => {
  // 状态管理
  const [testPassword, setTestPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthResult | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<SecurePasswordResponse | null>(null);
  const [passwordLength, setPasswordLength] = useState(16);
  const [resetUsername, setResetUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // 清除消息
  const clearMessage = () => {
    setTimeout(() => setMessage(null), 5000);
  };

  // 测试密码强度
  const handlePasswordTest = (password: string) => {
    const sanitized = sanitizeInput(password);
    setTestPassword(sanitized);
    
    if (sanitized) {
      const strength = checkPasswordStrength(sanitized);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  };

  // 调用API验证密码强度
  const handleAPIPasswordTest = async () => {
    if (!testPassword) {
      setMessage({ type: 'error', text: '请输入密码' });
      clearMessage();
      return;
    }

    setLoading(true);
    try {
      const result = await validatePasswordStrengthAPI(testPassword);
      setPasswordStrength(result.strength);
      setMessage({ type: 'success', text: '密码强度验证完成' });
    } catch (error) {
      setMessage({ type: 'error', text: '密码强度验证失败' });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // 生成安全密码
  const handleGeneratePassword = async () => {
    setLoading(true);
    try {
      const result = await generateSecurePassword(passwordLength);
      setGeneratedPassword(result);
      setMessage({ type: 'success', text: '安全密码生成成功' });
    } catch (error) {
      setMessage({ type: 'error', text: '生成安全密码失败' });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // 复制密码到剪贴板 - 移除未使用的函数

  // 请求密码重置
  const handleRequestReset = async () => {
    if (!resetUsername) {
      setMessage({ type: 'error', text: '请输入用户名' });
      clearMessage();
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(resetUsername);
      setMessage({ type: 'success', text: result.message });
      if (result.token) {
        setResetToken(result.token);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '密码重置请求失败' });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    if (!resetToken || !resetUsername || !newPassword) {
      setMessage({ type: 'error', text: '请填写所有必要信息' });
      clearMessage();
      return;
    }

    if (!isValidInput(newPassword)) {
      setMessage({ type: 'error', text: '密码包含不安全字符' });
      clearMessage();
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(resetToken, resetUsername, newPassword);
      setMessage({ type: 'success', text: result.message });
      setResetToken('');
      setResetUsername('');
      setNewPassword('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '密码重置失败';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // 更改密码
  const handleChangePassword = async () => {
    if (!currentPassword || !changeNewPassword || !token) {
      setMessage({ type: 'error', text: '请填写所有必要信息并确保已登录' });
      clearMessage();
      return;
    }

    if (!isValidInput(changeNewPassword)) {
      setMessage({ type: 'error', text: '新密码包含不安全字符' });
      clearMessage();
      return;
    }

    if (currentPassword === changeNewPassword) {
      setMessage({ type: 'error', text: '新密码不能与当前密码相同' });
      clearMessage();
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, changeNewPassword, token);
      setMessage({ type: 'success', text: result.message });
      setCurrentPassword('');
      setChangeNewPassword('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '密码更改失败';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  return (
    <PasswordManagerWrapper>
      <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '30px' }}>密码管理工具</h2>
      
      {message && (
        <Message type={message.type}>
          {message.text}
        </Message>
      )}

      {/* 密码强度测试 */}
      <Section>
        <SectionTitle>密码强度测试</SectionTitle>
        <InputGroup>
          <Label>输入密码进行强度测试</Label>
          <Input
            type="password"
            value={testPassword}
            onChange={(e) => handlePasswordTest(e.target.value)}
            placeholder="输入密码..."
          />
        </InputGroup>
        
        {passwordStrength && (
          <div>
            <PasswordStrengthText color={getPasswordStrengthColor(passwordStrength.strength)}>
              {passwordStrength.message} (评分: {passwordStrength.score}/6)
            </PasswordStrengthText>
            <PasswordStrengthBar 
              strength={getPasswordStrengthColor(passwordStrength.strength)}
              width={getPasswordStrengthWidth(passwordStrength.strength)}
            />
            
            {passwordStrength.issues.length > 0 && (
              <div>
                <strong style={{ color: '#e74c3c', fontSize: '12px' }}>问题:</strong>
                <IssuesList>
                  {passwordStrength.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </IssuesList>
              </div>
            )}
            
            {passwordStrength.suggestions.length > 0 && (
              <div>
                <strong style={{ color: '#f39c12', fontSize: '12px' }}>建议:</strong>
                <SuggestionsList>
                  {passwordStrength.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </SuggestionsList>
              </div>
            )}
          </div>
        )}
        
        <Button onClick={handleAPIPasswordTest} disabled={loading || !testPassword}>
          {loading ? '验证中...' : '使用API验证'}
        </Button>
      </Section>

      {/* 安全密码生成 */}
      <Section>
        <SectionTitle>安全密码生成</SectionTitle>
        <InputGroup>
          <Label>密码长度 (8-64)</Label>
          <Input
            type="number"
            min="8"
            max="64"
            value={passwordLength}
            onChange={(e) => setPasswordLength(Math.max(8, Math.min(64, parseInt(e.target.value) || 16)))}
          />
        </InputGroup>
        
        <Button onClick={handleGeneratePassword} disabled={loading}>
          {loading ? '生成中...' : '生成安全密码'}
        </Button>
        
        {generatedPassword && (
          <div>
            <GeneratedPasswordBox>
              <strong>生成的密码:</strong>
              <div style={{ marginTop: '10px', fontSize: '18px', color: '#2c3e50' }}>
                ••••••••••••••••
              </div>
              <CopyButton onClick={() => {
                // 这里需要解密密码才能显示，实际使用中应该直接显示明文
                setMessage({ type: 'info', text: '密码已加密，请使用解密功能查看' });
                clearMessage();
              }}>
                复制
              </CopyButton>
            </GeneratedPasswordBox>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
              强度: {generatedPassword.strength} | 长度: {generatedPassword.length}
            </div>
          </div>
        )}
      </Section>

      {/* 密码重置 */}
      <Section>
        <SectionTitle>密码重置</SectionTitle>
        <InputGroup>
          <Label>用户名</Label>
          <Input
            type="text"
            value={resetUsername}
            onChange={(e) => setResetUsername(sanitizeInput(e.target.value))}
            placeholder="输入用户名"
          />
        </InputGroup>
        
        <Button onClick={handleRequestReset} disabled={loading || !resetUsername}>
          {loading ? '请求中...' : '请求密码重置'}
        </Button>
        
        {resetToken && (
          <div>
            <InputGroup>
              <Label>重置令牌</Label>
              <Input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="重置令牌"
                readOnly
              />
            </InputGroup>
            
            <InputGroup>
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(sanitizeInput(e.target.value))}
                placeholder="输入新密码"
              />
            </InputGroup>
            
            <Button onClick={handleResetPassword} disabled={loading || !newPassword}>
              {loading ? '重置中...' : '重置密码'}
            </Button>
          </div>
        )}
      </Section>

      {/* 更改密码 */}
      {token && (
        <Section>
          <SectionTitle>更改密码</SectionTitle>
          <InputGroup>
            <Label>当前密码</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(sanitizeInput(e.target.value))}
              placeholder="输入当前密码"
            />
          </InputGroup>
          
          <InputGroup>
            <Label>新密码</Label>
            <Input
              type="password"
              value={changeNewPassword}
              onChange={(e) => setChangeNewPassword(sanitizeInput(e.target.value))}
              placeholder="输入新密码"
            />
          </InputGroup>
          
          <Button 
            onClick={handleChangePassword} 
            disabled={loading || !currentPassword || !changeNewPassword}
          >
            {loading ? '更改中...' : '更改密码'}
          </Button>
        </Section>
      )}
    </PasswordManagerWrapper>
  );
};

export default PasswordManager;