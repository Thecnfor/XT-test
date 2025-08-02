'use client'

import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Array<{id: string, content: string, sender: 'user' | 'ai', timestamp: number}>>([]);
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeClass = useSelector((state) => state?.nav?.activeClass || '');

  // 监听messages变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 滚动到底部函数
  const scrollToBottom = () => {
    // 确保在DOM更新后执行滚动
    setTimeout(() => {
      const chatHistory = document.querySelector('.chat-history');
      if (chatHistory) {
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }
    }, 0);
  };

  // 监听输入框变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  // 监听回车发送消息
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 处理发送按钮点击
  const handleSend = async () => {
    if (inputValue.trim() && !isAIGenerating) {
      // 标记聊天已开始
      if (!isChatStarted) {
        setIsChatStarted(true);
      }

      // 更新本地状态以立即显示消息
      const userMessage = {id: `user-${Date.now().toString()}`, content: inputValue, sender: 'user', timestamp: Date.now()};
      setMessages([...messages, userMessage]);
      // 清空输入框
      setInputValue('');

      // 发送消息到后端并处理流式响应
      await sendMessageToBackend([...messages, userMessage]);
    }
  };

  // 发送消息到后端并处理流式响应
  const sendMessageToBackend = async (currentMessages: Array<{id: string, content: string, sender: 'user' | 'ai', timestamp: number}>) => {
    setIsAIGenerating(true);

    // 准备发送给后端的消息格式
    const formattedMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...currentMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    // 创建AI消息的初始状态
    const aiMessageId = `ai-${Date.now().toString()}`;
    const initialAiMessage = { id: aiMessageId, content: '', sender: 'ai', timestamp: Date.now() };
    setMessages([...currentMessages, initialAiMessage]);

    try {
      // 发送请求到后端流式API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: formattedMessages })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream');
      }

      const decoder = new TextDecoder();
      let aiMessageContent = '';

      // 循环读取流数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // 分割SSE消息
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              // 流式响应结束
              break;
            }
            // 更新AI消息内容
            aiMessageContent += data;
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === aiMessageId ? { ...msg, content: aiMessageContent } : msg
              )
            );
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // 更新AI消息为错误信息
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === aiMessageId ? { ...msg, content: 'Sorry, there was an error processing your request.' } : msg
        )
      );
    } finally {
      setIsAIGenerating(false);
    }
  };

  const dataChat: string = "开始对话";
  return (
    <>
      <article className={`${activeClass} ${isChatStarted ? 'chat-started' : ''}`}>
        <div className={`container`}>
          {!isChatStarted ? (
            <div className='container-header'>
              {dataChat}
            </div>
          ) : (
            <div className='chat-history'>
              {messages.map(message => (
                <div 
                  key={message.id} 
                  className={`message ${message.sender === 'user' ? 'user-message' : 'ai-message'} ${message.sender === 'ai' && message.content === '' && isAIGenerating ? 'typing' : ''}`}
                >
                  <div className='message-content'>
                    {message.sender === 'ai' && message.content === '' && isAIGenerating ? (
                      <div className='typing-indicator'>
                        <span></span><span></span><span></span>
                      </div>
                    ) : message.sender === 'ai' ? (
                      <div className='markdown-content'>
                        <ReactMarkdown
                          rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          
          <div className='container-chat'>
            <div className='content'>
              <textarea 
                placeholder="请输入内容"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              ></textarea>
            </div>
            <div className='input'>
              <button 
                type="button" 
                title="发送" 
                disabled={!inputValue.trim() || isAIGenerating}
                onClick={handleSend}
              >
                <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 22L16 10M16 10L11 15M16 10L21 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
