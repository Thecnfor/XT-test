'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '@/store';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Array<{id: string, content: string, sender: 'user' | 'ai', timestamp: number}>>([]);
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isAbortedByUser, setIsAbortedByUser] = useState(false);
  const [isRequestActive, setIsRequestActive] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeClass = useAppSelector((state) => state?.navSwitch?.activeClass || '');

  // 停止AI生成
  const stopAIGeneration = () => {
    if (isAIGenerating) {
      setIsAbortedByUser(true);
      setIsAIGenerating(false);
      if (abortControllerRef.current && isRequestActive) {
        try {
          abortControllerRef.current.abort();
        } catch (error) {
          console.error('请求中止失败，这就很尴尬了:', error);
        }
        abortControllerRef.current = null;
        setIsRequestActive(false);
      }
    }
  };

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
      handleSend().then(() => scrollToBottom());
    }
  };

  // 处理发送按钮点击
  const handleSend = async () => {
    if (isAIGenerating) {
      stopAIGeneration();
      return;
    }

    if (inputValue.trim()) {
      // 标记聊天已开始
      if (!isChatStarted) {
        setIsChatStarted(true);
      }

      // 更新本地状态以立即显示消息
      const userMessage: {id: string, content: string, sender: 'user' | 'ai', timestamp: number} = {
        id: `user-${Date.now().toString()}`,
        content: inputValue,
        sender: 'user',
        timestamp: Date.now()
      };
      setMessages([...messages, userMessage]);
      // 清空输入框
      setInputValue('');

      // 发送消息到后端并处理流式响应
      await sendMessageToBackend([...messages, userMessage]);
    }
  };

  // 发送消息到后端并处理流式响应
  const sendMessageToBackend = async (currentMessages: Array<{id: string, content: string, sender: 'user' | 'ai', timestamp: number}>) => {
    // 确保之前的控制器已被清理
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (error) {
        console.error('中止上一个请求失败，它可能赖着不想走:', error);
      }
      abortControllerRef.current = null;
    }

    // 创建新的AbortController
    abortControllerRef.current = new AbortController();
    setIsAIGenerating(true);
    setIsAbortedByUser(false);
    setIsRequestActive(true);
    let wasAbortedByUser = false;

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
    const initialAiMessage: {id: string, content: string, sender: 'user' | 'ai', timestamp: number} = {
      id: aiMessageId,
      content: '',
      sender: 'ai',
      timestamp: Date.now()
    };
    setMessages([...currentMessages, initialAiMessage]);

    try {
      // 发送请求到后端流式API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current?.signal,
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
      let buffer = ''; // 用于累积不完整的行

      // 使用requestAnimationFrame优化UI更新
      let animationFrameId: number;
      // 跟踪上次更新的内容，用于优化UI更新频率
      let lastUpdatedContent = '';

      const updateUI = () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(() => {
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === aiMessageId ? { ...msg, content: aiMessageContent } : msg
            )
          );
        });
      };

      // 循环读取流数据
      try {
        while (true) {
          // 检查是否已被用户中止
          if (isAbortedByUser) {
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // 改进的SSE消息处理逻辑
          // 分割SSE消息（处理可能不完整的行）
          let lineEndIndex;
          while ((lineEndIndex = buffer.indexOf('\n\n')) !== -1) {
            const line = buffer.substring(0, lineEndIndex);
            buffer = buffer.substring(lineEndIndex + 2); // 跳过\n\n
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data === '[DONE]') {
                // 流式响应结束
                break;
              }
              // 更新AI消息内容
              aiMessageContent += data;
            }
          }

          // 处理剩余的buffer内容（如果有）
          if (buffer && buffer.startsWith('data: ')) {
            const data = buffer.substring(6);
            if (data !== '[DONE]') {
              aiMessageContent += data;
            }
          }

          // 优化UI更新频率，避免过于频繁的更新
          if (aiMessageContent !== lastUpdatedContent) {
            updateUI();
            lastUpdatedContent = aiMessageContent;
          }
        }

        // 处理剩余的buffer内容（如果有）
        if (buffer) {
          const lines = buffer.split('\n\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data !== '[DONE]') {
                aiMessageContent += data;
              }
            }
          }
          updateUI(); // 确保最后一次更新
        }
      } catch (streamError) {
        // 处理流读取过程中的错误
        if (!(streamError instanceof DOMException && streamError.name === 'AbortError')) {
          console.error('Error reading stream:', streamError);
        } else {
          wasAbortedByUser = true;
        }
      } finally {
        // 确保关闭读取器，但仅在未被用户中止的情况下
        try {
          if (reader && !wasAbortedByUser) {
            await reader.cancel();
          }
        } catch (cancelError) {
          // 忽略用户中止导致的取消错误
          if (!(cancelError instanceof DOMException && cancelError.name === 'AbortError')) {
            console.error('Error canceling reader:', cancelError);
          }
        }
      }
    } catch (error) {
      // 精确处理AbortError
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('用户已中止请求，AI只能闭嘴了！');
      } else {
        console.error('发送消息失败，消息可能迷路了:', error);
        // 使用函数形式确保获取最新状态
        setMessages(prevMessages => {
          // 区分用户主动中止和其他错误
          if (isAbortedByUser) {
            // 用户主动中止，清除AI消息
            return prevMessages.filter(msg => msg.id !== aiMessageId);
          } else {
            // 更新AI消息为错误信息
            return prevMessages.map(msg => 
              msg.id === aiMessageId ? { ...msg, content: 'Sorry, there was an error processing your request.' } : msg
            );
          }
        });
      }
    } finally {
      setIsAIGenerating(false);
      setIsRequestActive(false);
      // 重置用户中止状态
      setIsAbortedByUser(false);
      // 清理AbortController
      abortControllerRef.current = null;
    }
  }

  const helloChat: string = "开始对话";
  return (
    <>
      <article className={`${activeClass} ${isChatStarted ? 'chat-started' : ''}`}>
        <div className={`container`}>
          {!isChatStarted ? (
            <div className='container-header'>
              {helloChat}
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
                disabled={!inputValue.trim() && !isAIGenerating}
                onClick={handleSend}
              >
                {!isAIGenerating ? (
                  <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 22L16 10M16 10L11 15M16 10L21 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                ) : (
                  <div className={'generating'}></div>
                )}
              </button>
            </div>
          </div>
          <div className='docker-container'>
            123
          </div>
        </div>
      </article>
    </>
  );
}
