// 应用程序配置
export const APP_CONFIG = {
  // 加载屏幕最小显示时间（毫秒）
  minLoadingDisplayTime: 0,
  
  // 安全配置
  security: {
    // 加密密钥 - 必须与前端和后端保持一致
    encryptionKey: 'your-encryption-key-here', // 生产环境中应使用环境变量
  },
  
  // 会话配置
  session: {
    // 会话检查间隔（毫秒）
    checkInterval: 300000, // 5分钟
    // 会话即将过期的警告阈值（分钟）
    expiryWarningThreshold: 5,
    // 会话检查请求超时时间（毫秒）
    checkTimeout: 500, // 0.5秒
    // 最小检查间隔（毫秒）
    minCheckInterval: 5000, // 5秒
  },
};