import CryptoJS from 'crypto-js';
import { APP_CONFIG } from '@/lib/config';

/**
 * 前端密码处理工具库
 * 与后端 PasswordService 完全兼容
 */

// 密码强度等级
export type PasswordStrength = 'weak' | 'medium' | 'strong';

// 密码强度检查结果
export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number;
  valid: boolean;
  message: string;
  issues: string[];
  suggestions: string[];
}

// API响应类型
export interface PasswordValidationResponse {
  success: boolean;
  strength: PasswordStrengthResult;
}

export interface SecurePasswordResponse {
  success: boolean;
  encrypted_password: string;
  strength: PasswordStrength;
  length: number;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  token?: string;
}

export interface PasswordChangeResponse {
  success: boolean;
  message: string;
}

/**
 * 密码加密函数 - 与后端解密逻辑完全匹配
 * @param password 原始密码
 * @returns 加密后的base64字符串
 */
export const encryptPassword = (password: string): string => {
  try {
    // 使用配置中的加密密钥
    const key = CryptoJS.enc.Utf8.parse(APP_CONFIG.security.encryptionKey);
    const salt = CryptoJS.lib.WordArray.random(8); // 8字节salt
    
    // 使用PBKDF2生成密钥和IV (与后端一致)
    // 注意：设置为1次迭代以匹配后端
    const keyIV = CryptoJS.PBKDF2(key, salt, {
      keySize: (32 + 16) / 4, // 32字节密钥 + 16字节IV
      iterations: 1,
      hasher: CryptoJS.algo.SHA1
    });
    
    // 手动提取密钥和IV
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
  } catch (error) {
    console.error('密码加密失败:', error);
    throw new Error('密码加密失败');
  }
};

/**
 * 本地密码强度检查
 * @param password 密码
 * @returns 密码强度结果
 */
export const checkPasswordStrength = (password: string): PasswordStrengthResult => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // 长度检查
  if (password.length < 8) {
    issues.push('密码长度至少需要8位');
    suggestions.push('增加密码长度到至少8位');
  } else if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  // 字符类型检查
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasLowerCase) {
    issues.push('缺少小写字母');
    suggestions.push('添加小写字母');
  } else {
    score += 1;
  }

  if (!hasUpperCase) {
    issues.push('缺少大写字母');
    suggestions.push('添加大写字母');
  } else {
    score += 1;
  }

  if (!hasNumbers) {
    issues.push('缺少数字');
    suggestions.push('添加数字');
  } else {
    score += 1;
  }

  if (!hasSpecialChars) {
    issues.push('缺少特殊字符');
    suggestions.push('添加特殊字符 (!@#$%^&* 等)');
  } else {
    score += 1;
  }

  // 常见密码检查
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', '123123'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    issues.push('密码过于常见');
    suggestions.push('避免使用常见密码');
    score = Math.max(0, score - 2);
  }

  // 重复字符检查
  const hasRepeatingChars = /(.)\1{2,}/.test(password);
  if (hasRepeatingChars) {
    issues.push('包含过多重复字符');
    suggestions.push('减少重复字符的使用');
    score = Math.max(0, score - 1);
  }

  // 确定强度等级
  let strength: PasswordStrength;
  let message: string;
  const valid = score >= 4 && password.length >= 8;

  if (score <= 2) {
    strength = 'weak';
    message = '密码强度：弱';
  } else if (score <= 4) {
    strength = 'medium';
    message = '密码强度：中等';
  } else {
    strength = 'strong';
    message = '密码强度：强';
  }

  return {
    strength,
    score,
    valid,
    message,
    issues,
    suggestions
  };
};

/**
 * 调用后端API验证密码强度
 * @param password 加密后的密码
 * @returns 后端验证结果
 */
export const validatePasswordStrengthAPI = async (password: string): Promise<PasswordValidationResponse> => {
  try {
    const encryptedPassword = encryptPassword(password);
    
    const response = await fetch('http://localhost:8000/auth/validate_password_strength', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        encrypted_password: encryptedPassword
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('密码强度验证API调用失败:', error);
    throw error;
  }
};

/**
 * 生成安全密码
 * @param length 密码长度 (8-64)
 * @returns 生成的安全密码信息
 */
export const generateSecurePassword = async (length: number = 16): Promise<SecurePasswordResponse> => {
  try {
    const response = await fetch('http://localhost:8000/auth/generate_secure_password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        length: Math.max(8, Math.min(64, length))
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('生成安全密码API调用失败:', error);
    throw error;
  }
};

/**
 * 请求密码重置
 * @param username 用户名
 * @returns 重置请求结果
 */
export const requestPasswordReset = async (username: string): Promise<PasswordResetResponse> => {
  try {
    const response = await fetch('http://localhost:8000/auth/request_password_reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('密码重置请求API调用失败:', error);
    throw error;
  }
};

/**
 * 重置密码
 * @param token 重置令牌
 * @param username 用户名
 * @param newPassword 新密码
 * @returns 重置结果
 */
export const resetPassword = async (
  token: string,
  username: string,
  newPassword: string
): Promise<PasswordChangeResponse> => {
  try {
    const encryptedPassword = encryptPassword(newPassword);
    
    const response = await fetch('http://localhost:8000/auth/reset_password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        username,
        new_password: encryptedPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('密码重置API调用失败:', error);
    throw error;
  }
};

/**
 * 更改密码
 * @param currentPassword 当前密码
 * @param newPassword 新密码
 * @param token 认证令牌
 * @returns 更改结果
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
  token: string
): Promise<PasswordChangeResponse> => {
  try {
    const encryptedCurrentPassword = encryptPassword(currentPassword);
    const encryptedNewPassword = encryptPassword(newPassword);
    
    const response = await fetch('http://localhost:8000/auth/change_password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        current_password: encryptedCurrentPassword,
        new_password: encryptedNewPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('密码更改API调用失败:', error);
    throw error;
  }
};

/**
 * 输入清理函数
 * @param input 用户输入
 * @returns 清理后的输入
 */
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>"'&]/g, '');
};

/**
 * 验证输入是否安全
 * @param input 用户输入
 * @returns 是否安全
 */
export const isValidInput = (input: string): boolean => {
  // 检查是否包含危险字符
  const dangerousChars = /<script|javascript:|data:|vbscript:|onload|onerror/i;
  return !dangerousChars.test(input) && input.length > 0 && input.length <= 255;
};

/**
 * 生成随机字符串
 * @param length 长度
 * @returns 随机字符串
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 密码强度颜色映射
 * @param strength 密码强度
 * @returns 对应的颜色
 */
export const getPasswordStrengthColor = (strength: PasswordStrength): string => {
  switch (strength) {
    case 'weak':
      return '#ff4757'; // 红色
    case 'medium':
      return '#ffa502'; // 橙色
    case 'strong':
      return '#2ed573'; // 绿色
    default:
      return '#747d8c'; // 灰色
  }
};

/**
 * 密码强度进度条宽度
 * @param strength 密码强度
 * @returns 进度条宽度百分比
 */
export const getPasswordStrengthWidth = (strength: PasswordStrength): number => {
  switch (strength) {
    case 'weak':
      return 33;
    case 'medium':
      return 66;
    case 'strong':
      return 100;
    default:
      return 0;
  }
};