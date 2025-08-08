// 应用程序配置
export const APP_CONFIG = {
  // 加载屏幕最小显示时间（毫秒）
  minLoadingDisplayTime: 0,
  
  // 会话配置
  session: {
    // 会话检查间隔（毫秒）
    checkInterval: 300000, // 5分钟
    // 会话即将过期的警告阈值（分钟）
    expiryWarningThreshold: 5,
    // 会话检查请求超时时间（毫秒）
    checkTimeout: 500, // 0.5秒
  },
};