'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect, useState } from 'react';

interface AdminContentProps {
  isAdminVerified: boolean;
  sessionId: string;
  token: string;
}

// 管理员特有内容的客户端组件
export default function AdminContent({ isAdminVerified, sessionId, token }: AdminContentProps) {
  const [showContent, setShowContent] = useState(false);
  
  const {
    isConnected,
    isAdminVerified: wsAdminVerified,
    sendMessage,
    disconnect,
    reconnect
  } = useWebSocket({
    sessionId,
    token,
    autoConnect: true,
    onConnect: () => {
      console.log('WebSocket连接成功');
    },
    onDisconnect: () => {
      console.log('WebSocket连接断开');
      setShowContent(false);
    },
    onMessage: (message) => {
      console.log('收到消息:', message);
    }
  });

  // 只有当服务器端验证通过且WebSocket连接正常且管理员权限验证通过时才显示内容
  useEffect(() => {
    setShowContent(isAdminVerified && isConnected && wsAdminVerified);
  }, [isAdminVerified, isConnected, wsAdminVerified]);

  // 如果服务器端验证未通过，直接返回null
  if (!isAdminVerified) {
    return null;
  }

  return (
    <div className='admin-content'>
      {/* WebSocket连接状态指示器 */}
      <div className='connection-status mb-4 p-3 rounded-lg border'>
        <h3 className='text-lg font-semibold mb-2'>连接状态</h3>
        <div className='flex items-center gap-4'>
          <div className={`flex items-center gap-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>WebSocket: {isConnected ? '已连接' : '未连接'}</span>
          </div>
          <div className={`flex items-center gap-2 ${wsAdminVerified ? 'text-green-600' : 'text-orange-600'}`}>
            <div className={`w-3 h-3 rounded-full ${wsAdminVerified ? 'bg-green-500' : 'bg-orange-500'}`}></div>
            <span>管理员权限: {wsAdminVerified ? '已验证' : '未验证'}</span>
          </div>
        </div>
        <div className='mt-2 flex gap-2'>
          <button 
            onClick={reconnect}
            className='px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600'
          >
            重新连接
          </button>
          <button 
            onClick={disconnect}
            className='px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600'
          >
            断开连接
          </button>
        </div>
      </div>

      {/* 管理员内容 - 只有在WebSocket连接且权限验证通过时才显示 */}
      {showContent ? (
        <div className='admin-panel'>
          <h2 className='text-2xl font-bold mb-4'>管理员控制面板</h2>
          <div className='bg-green-50 border border-green-200 rounded-lg p-4 mb-4'>
            <p className='text-green-800'>✅ WebSocket连接正常，管理员权限已验证</p>
            <p className='text-sm text-green-600 mt-1'>这里是只有通过WebSocket连接的管理员才能看到的敏感内容</p>
          </div>
          
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='bg-white border rounded-lg p-4'>
              <h3 className='text-lg font-semibold mb-2'>用户管理</h3>
              <p className='text-gray-600'>管理系统用户账户</p>
            </div>
            <div className='bg-white border rounded-lg p-4'>
              <h3 className='text-lg font-semibold mb-2'>系统设置</h3>
              <p className='text-gray-600'>配置系统参数</p>
            </div>
            <div className='bg-white border rounded-lg p-4'>
              <h3 className='text-lg font-semibold mb-2'>权限控制</h3>
              <p className='text-gray-600'>管理用户权限</p>
            </div>
            <div className='bg-white border rounded-lg p-4'>
              <h3 className='text-lg font-semibold mb-2'>日志审计</h3>
              <p className='text-gray-600'>查看系统日志</p>
            </div>
          </div>
          
          {/* WebSocket实时功能演示 */}
          <div className='mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <h3 className='text-lg font-semibold mb-2'>实时功能</h3>
            <button 
              onClick={() => sendMessage({ type: 'check_admin_status' })}
              className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
            >
              检查管理员状态
            </button>
          </div>
        </div>
      ) : (
        <div className='access-denied bg-red-50 border border-red-200 rounded-lg p-4'>
          <h2 className='text-xl font-semibold text-red-800 mb-2'>访问受限</h2>
          <p className='text-red-600 mb-2'>需要满足以下条件才能访问管理员内容：</p>
          <ul className='text-red-600 space-y-1'>
            <li>✅ 服务器端管理员验证: {isAdminVerified ? '已通过' : '未通过'}</li>
            <li className={isConnected ? 'text-green-600' : 'text-red-600'}>
              {isConnected ? '✅' : '❌'} WebSocket连接: {isConnected ? '已连接' : '未连接'}
            </li>
            <li className={wsAdminVerified ? 'text-green-600' : 'text-red-600'}>
              {wsAdminVerified ? '✅' : '❌'} WebSocket管理员验证: {wsAdminVerified ? '已通过' : '未通过'}
            </li>
          </ul>
          {!isConnected && (
            <button 
              onClick={reconnect}
              className='mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
            >
              尝试连接WebSocket
            </button>
          )}
        </div>
      )}
    </div>
  );
}