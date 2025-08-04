'use client'

import React, { useState, useEffect, memo } from 'react';

// 内联样式以确保优先加载
const styles = {
  loadingOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'var(--bg-color)',
    zIndex: 9999,
    display: 'flex' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    transition: 'opacity 1s ease-out, transform 1s ease-out, filter 1s ease-out, z-index 0s linear 1s',
    userSelect: 'none' as const,
  },
  loadingContent: {
    width: '100%',
    height: '100%',
    display: 'flex' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    transition: 'transform 1s ease-out',
  },
  // 消失动画的样式
  fadingOut: {
    opacity: 0,
    transform: 'scale(0.9)',
    filter: 'blur(500px)',
    zIndex: -10,
  },
};

const Loader = () => {
  return (
    <div className='loading-screen'>
      <span className="loader" />
    </div>
  );
}

const LoadingScreen = () => {
  // 使用 sessionStorage 确保只在当前会话中显示一次
  const [isLoading, setIsLoading] = useState(() => {
    // 在服务器端或浏览器不支持sessionStorage时默认显示加载画面
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return true;
    }
    // 检查当前会话是否已经显示过加载画面
    return !sessionStorage.getItem('hasShownLoading');
  });
  const [isFadingOut, setIsFadingOut] = useState(false);

  // 优化加载检测逻辑 - 无计时器版本
  useEffect(() => {
    // 如果已经加载过，则不执行加载检测逻辑
    if (!isLoading) {
      return;
    }

    // 标记为已显示，确保只显示一次
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('hasShownLoading', 'true');
    }

    // 确保至少显示2秒
    const minDisplayTime = 2000;
    const startTime = Date.now();

    // 检查关键CSS是否已加载
    const checkCriticalStyles = () => {
      // 检查body是否有来自globals.css的类名，增加备选检查方式
      const hasAntialiased = document.body.classList.contains('antialiased');
      const hasBgColor = document.body.style.backgroundColor !== '';
      
      return hasAntialiased || hasBgColor;
    };

    // 使用requestAnimationFrame进行高效检查
    let animationFrameId: number;

    const checkStyles = () => {
      const elapsedTime = Date.now() - startTime;
      if (checkCriticalStyles() && elapsedTime >= minDisplayTime) {
        console.log('Critical styles loaded and minimum time elapsed');
        startFadeOut();
      } else {
        animationFrameId = requestAnimationFrame(checkStyles);
      }
    };

    // 立即开始检查
    animationFrameId = requestAnimationFrame(checkStyles);

    // 监听load事件作为后备
    const handleLoad = () => {
      console.log('Window load event triggered');
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= minDisplayTime) {
        startFadeOut();
      } else {
        // 如果还没到2秒，等待剩余时间
        setTimeout(() => {
          startFadeOut();
        }, minDisplayTime - elapsedTime);
      }
      cancelAnimationFrame(animationFrameId);
    };

    window.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('load', handleLoad);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isLoading]);

  // 开始淡出动画
  const startFadeOut = () => {
    setIsFadingOut(true);
    // 移除setTimeout，依赖onTransitionEnd事件
  };

  // 监听过渡动画完成事件
  const handleTransitionEnd = () => {
    if (isFadingOut) {
      setIsLoading(false);
    }
  };

  if (!isLoading) return null;

  // 合并基础样式和动画样式
  const overlayStyle: React.CSSProperties = {
    ...styles.loadingOverlay,
    ...(isFadingOut ? styles.fadingOut : {}),
  };

  // 内容缩放动画
  const contentStyle: React.CSSProperties = {
    ...styles.loadingContent,
    transform: isFadingOut ? 'scale(0)' : 'scale(1)',
  };

  return (
    <div style={overlayStyle} onTransitionEnd={handleTransitionEnd}>
      <div style={contentStyle}>
        <Loader />
      </div>
    </div>
  );
};


export default memo(LoadingScreen);
