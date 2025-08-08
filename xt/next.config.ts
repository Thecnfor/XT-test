import type { NextConfig } from 'next';

// 从环境变量获取后端API地址，默认为localhost:8000
const backendApi = process.env.BACKEND_API || 'http://localhost:8000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 输出独立模式，便于部署
  output: 'standalone',
  // 启用响应压缩
  compress: true,
  // 优化图片加载
  images: {
    domains: [], // 可以添加图片域名白名单
    formats: ['image/avif', 'image/webp'],
  },
  // 生产环境日志配置
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    
    // CSP配置 - 区分开发和生产环境
    // 根据环境设置不同的CSP策略
    const cspPolicy = isDev
      ? // 开发环境下允许更多宽松的设置以便于调试
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    `connect-src 'self' ${backendApi}; ` +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    // 开发环境下不强制升级HTTP请求
    ""
      : // 生产环境下使用更严格的设置
     "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    `connect-src 'self' ${backendApi}; ` +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    // 开发环境下不强制升级HTTP请求
    ""

    return [
      {
        // 应用于所有路由
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspPolicy,
          },
          // 添加额外的安全头
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
