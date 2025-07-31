'use client'

import styled from 'styled-components';
import { useState } from 'react';
import { useSelector } from 'react-redux';
export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const dataChat:string = '你好'
  const activeClass = useSelector((state) => state?.nav?.activeClass || '');
  return (
    <>
     <article className={activeClass}>
        <div className={`container`}>
          <div className='container-header'>
            {dataChat}
          </div>
          <div className='container-chat'>
            <div className='content'>
              <textarea 
                placeholder="请输入内容"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              ></textarea>
            </div>
            <div className='input'>
              <button type="button" title="发送" disabled={!inputValue.trim()}>
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
