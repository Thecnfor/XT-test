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

  // 如果服务器端验证未通过，显示详细报告
  if (!isAdminVerified) {
    return (
      <div>
        <h2>访问受限</h2>
        <p>需要满足以下条件才能访问管理员内容：</p>
        <ul>
          <li>
            ❌ 服务器端管理员验证: 未通过
          </li>
          <li>
            ⏸️ WebSocket连接: 待验证
          </li>
          <li>
            ⏸️ WebSocket管理员验证: 待验证
          </li>
        </ul>
        <div>
          <p>请确保您具有管理员权限后重新访问此页面。</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* WebSocket连接状态指示器 */}
      <div>
        <h3>连接状态</h3>
        <div>
          <div>
            <div></div>
            <span>WebSocket: {isConnected ? '已连接' : '未连接'}</span>
          </div>
          <div>
            <div></div>
            <span>管理员权限: {wsAdminVerified ? '已验证' : '未验证'}</span>
          </div>
        </div>
        <div>
          <button 
            onClick={reconnect}
          >
            重新连接
          </button>
          <button 
            onClick={disconnect}
          >
            断开连接
          </button>
        </div>
      </div>

      {/* 管理员内容 - 只有在WebSocket连接且权限验证通过时才显示 */}
      {showContent ? (
        <div>
          <h2>管理员控制面板</h2>
          <div>
            <p>✅ WebSocket连接正常，管理员权限已验证</p>
            <p>这里是只有通过WebSocket连接的管理员才能看到的敏感内容</p>
          </div>
          
          <div>
            <div>
              <h3>用户管理</h3>
              <p>管理系统用户账户</p>
            </div>
            <div>
              <h3>系统设置</h3>
              <p>配置系统参数</p>
            </div>
            <div>
              <h3>权限控制</h3>
              <p>管理用户权限</p>
            </div>
            <div>
              <h3>日志审计</h3>
              <p>查看系统日志</p>
            </div>
          </div>
          
          {/* WebSocket实时功能演示 */}
          <div>
            <h3>实时功能</h3>
            <button 
              onClick={() => sendMessage({ type: 'check_admin_status' })}
            >
              检查管理员状态
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div>
            <h2>正在验证管理员权限</h2>
            <div>
              <Loader />
            </div>
          </div>
          
          <div>
            <h3>验证状态详情</h3>
            <p>需要满足以下条件才能访问管理员内容：</p>
            <ul>
              <li>
                ✅ 服务器端管理员验证: 已通过
              </li>
              <li>
                {isConnected ? '✅' : '❌'} WebSocket连接: {isConnected ? '已连接' : '未连接'}
              </li>
              <li>
                {wsAdminVerified ? '✅' : '⏳'} WebSocket管理员验证: {wsAdminVerified ? '已通过' : '验证中...'}
              </li>
            </ul>
            {!isConnected && (
              <button 
                onClick={reconnect}
              >
                尝试连接WebSocket
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import styled from 'styled-components';

const Loader = () => {
  return (
    <StyledWrapper>
      <div>
        <div className="jelly-triangle">
          <div className="jelly-triangle__dot" />
          <div className="jelly-triangle__traveler" />
        </div>
        <svg width={0} height={0} className="jelly-maker">
          <defs>
            <filter id="uib-jelly-triangle-ooze">
              <feGaussianBlur in="SourceGraphic" stdDeviation="7.3" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="ooze" />
              <feBlend in="SourceGraphic" in2="ooze" />
            </filter>
          </defs>
        </svg>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .jelly-triangle {
    --uib-size: 2.8rem;
    --uib-speed: 1.75s;
    --uib-color: #183153;
    position: relative;
    height: var(--uib-size);
    width: var(--uib-size);
    filter: url('#uib-jelly-triangle-ooze');
  }

  .jelly-triangle__dot,
  .jelly-triangle::before,
  .jelly-triangle::after {
    content: '';
    position: absolute;
    width: 33%;
    height: 33%;
    background: var(--uib-color);
    border-radius: 100%;
    box-shadow: 0 0 20px rgba(18, 31, 53, 0.3);
  }

  .jelly-triangle__dot {
    top: 6%;
    left: 30%;
    animation: grow7132 var(--uib-speed) ease infinite;
  }

  .jelly-triangle::before {
    bottom: 6%;
    right: 0;
    animation: grow7132 var(--uib-speed) ease calc(var(--uib-speed) * -0.666)
      infinite;
  }

  .jelly-triangle::after {
    bottom: 6%;
    left: 0;
    animation: grow7132 var(--uib-speed) ease calc(var(--uib-speed) * -0.333)
      infinite;
  }

  .jelly-triangle__traveler {
    position: absolute;
    top: 6%;
    left: 30%;
    width: 33%;
    height: 33%;
    background: var(--uib-color);
    border-radius: 100%;
    animation: triangulate6214 var(--uib-speed) ease infinite;
  }

  .jelly-maker {
    width: 0;
    height: 0;
    position: absolute;
  }

  @keyframes triangulate6214 {
    0%,
    100% {
      transform: none;
    }

    33.333% {
      transform: translate(120%, 175%);
    }

    66.666% {
      transform: translate(-95%, 175%);
    }
  }

  @keyframes grow7132 {
    0%,
    100% {
      transform: scale(1.5);
    }

    20%,
    70% {
      transform: none;
    }
  }`;
