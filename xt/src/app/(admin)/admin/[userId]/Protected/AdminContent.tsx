import { cookies } from 'next/headers';

// 管理员特有内容的服务器组件
export default function AdminContent({ isAdminVerified }: { isAdminVerified: boolean }) {
  // 从props接收已验证的管理员状态

  // 只有在验证通过后才渲染管理员内容
  if (!isAdminVerified) {
    return null;
  }

  // 直接渲染管理员内容
  

  return (
    <div className='admin-content'>
      <h2>管理员控制面板</h2>
      <p>这里是只有管理员才能看到的敏感内容</p>
      <ul>
        <li>用户管理</li>
        <li>系统设置</li>
        <li>权限控制</li>
        <li>日志审计</li>
      </ul>
      {/* 更多管理员功能将在这里实现 */}
    </div>
  );
}