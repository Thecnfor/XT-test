import { useState, useEffect } from 'react';
import io from 'socket.io-client';

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<any>(null);

  // 初始化Socket连接
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // 监听消息事件
    newSocket.on('message', (message: string) => {
      setMessages(prev => [...prev, message]);
    });

    // 清理函数
    return () => newSocket.disconnect();
  }, []);

  // 发送消息处理函数
  const handleSend = () => {
    if (input.trim() && socket) {
      socket.emit('message', input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Xrak 实时通信</h1>
      
      {/* 消息列表 */}
      <div className="flex-1 border rounded-lg p-4 overflow-y-auto mb-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div key={index} className="mb-2 p-2 bg-white rounded shadow-sm">
            {msg}
          </div>
        ))}
      </div>

      {/* 输入区域 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 border rounded p-2"
          placeholder="输入消息..."
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          发送
        </button>
      </div>
    </div>
  );
}
