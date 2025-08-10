'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
// 移除socket.io-client导入，使用原生WebSocket

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isAdminVerified: boolean;
  sendMessage: (message: any) => void;
  disconnect: () => void;
  reconnect: () => void;
}

interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  autoConnect?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({
  sessionId,
  token,
  autoConnect = true,
  onMessage,
  onConnect,
  onDisconnect
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  const isConnectingRef = useRef(false);
  
  // 使用ref保存最新的回调函数，避免闭包问题
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onMessageRef = useRef(onMessage);
  
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onMessageRef.current = onMessage;
  }, [onConnect, onDisconnect, onMessage]);

  const connect = useCallback(() => {
    // 如果已经有连接或正在连接，先断开
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        console.log('WebSocket已连接，无需重复连接');
        return;
      }
      if (socketRef.current.readyState === WebSocket.CONNECTING) {
        console.log('WebSocket正在连接中，等待连接完成');
        return;
      }
      // 清理旧连接
      socketRef.current.close();
      socketRef.current = null;
    }

    if (isConnectingRef.current) {
      console.log('连接正在进行中，跳过重复连接');
      return;
    }

    if (!sessionId || !token) {
      console.warn('缺少sessionId或token，无法建立WebSocket连接');
      return;
    }

    try {
      isConnectingRef.current = true;
      const wsUrl = `ws://localhost:8000/ws/${sessionId}`;
      console.log('正在连接WebSocket:', wsUrl);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket连接已建立');
        isConnectingRef.current = false;
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();

        // 发送管理员验证请求
        const verifyMessage = {
          type: 'verify_admin',
          token: token,
          session_id: sessionId
        };
        socket.send(JSON.stringify(verifyMessage));

        // 开始心跳检测
        startPing();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('收到WebSocket消息:', data);
          
          if (data.type === 'admin_verification_result') {
            setIsAdminVerified(data.success);
            if (data.success) {
              console.log('管理员权限验证成功');
            } else {
              console.warn('管理员权限验证失败:', data.message);
            }
          } else if (data.type === 'pong') {
            // 心跳响应
            console.log('收到心跳响应');
          } else if (data.type === 'connection_established') {
            console.log('WebSocket连接确认:', data.message);
          }
          
          onMessageRef.current?.(data);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error, event.data);
        }
      };

      socket.onclose = (event) => {
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        isConnectingRef.current = false;
        setIsConnected(false);
        setIsAdminVerified(false);
        stopPing();
        onDisconnectRef.current?.();

        // 自动重连
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          console.log('达到最大重连次数，停止重连');
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket错误:', error);
        isConnectingRef.current = false;
      };

    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
    }
  }, [sessionId, token]); // 移除回调函数依赖，避免重新创建连接

  const disconnect = useCallback(() => {
    isConnectingRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    stopPing();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsAdminVerified(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }, []);

  const startPing = useCallback(() => {
    stopPing(); // 清理之前的定时器
    
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({
          type: 'ping',
          timestamp: Date.now()
        });
      }
    }, 30000); // 每30秒发送一次心跳
  }, [sendMessage]);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(() => {
      connect();
    }, 1000);
  }, [connect, disconnect]);

  useEffect(() => {
    if (autoConnect && sessionId && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, sessionId, token]); // 移除connect和disconnect依赖，避免无限重连

  return {
    isConnected,
    isAdminVerified,
    sendMessage,
    disconnect,
    reconnect
  };
}