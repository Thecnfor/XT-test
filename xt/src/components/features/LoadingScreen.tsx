'use client'

import React, { useState, useEffect, memo } from 'react';
import { APP_CONFIG } from '@/lib/config';

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
  // 智能判断是否显示加载画面
  const [isLoading, setIsLoading] = useState(() => {
    // 在服务器端时默认显示加载画面
    if (typeof window === 'undefined') {
      return true;
    }
    
    // 开发环境：每次都显示
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    // 生产环境：总是显示加载画面，但通过其他逻辑控制显示时长
    return true;
  });
  const [isFadingOut, setIsFadingOut] = useState(false);

  // 优化加载检测逻辑 - 无计时器版本
  useEffect(() => {
    // 如果已经加载过，则不执行加载检测逻辑
    if (!isLoading) {
      return;
    }

    // 移除sessionStorage逻辑，确保每次都能正常加载

    // 确保至少显示2秒
    const minDisplayTime = APP_CONFIG.minLoadingDisplayTime;
    const startTime = Date.now();

    // 检查关键CSS是否已加载
    const checkCriticalStyles = () => {
      // 检查document.readyState
      if (document.readyState === 'complete') {
        return true;
      }
      
      // 检查body是否有来自globals.css的类名，增加备选检查方式
      const hasAntialiased = document.body.classList.contains('antialiased');
      const hasBgColor = document.body.style.backgroundColor !== '';
      
      // 检查是否有CSS变量被设置
      const computedStyle = window.getComputedStyle(document.body);
      const hasCSSVars = computedStyle.getPropertyValue('--bg-color') !== '';
      
      return hasAntialiased || hasBgColor || hasCSSVars;
    };

    // 使用requestAnimationFrame进行高效检查
    let animationFrameId: number;

    const checkStyles = () => {
      const elapsedTime = Date.now() - startTime;
      if (checkCriticalStyles() && elapsedTime >= minDisplayTime) {
        console.log('关键样式已加载，等待时间已达标，可以揭开神秘面纱啦！');
        startFadeOut();
      } else {
        animationFrameId = requestAnimationFrame(checkStyles);
      }
    };

    // 立即开始检查
    animationFrameId = requestAnimationFrame(checkStyles);

    // 监听load事件作为后备
    const handleLoad = () => {
      console.log('窗口加载事件已触发，页面准备好和你见面啦！');
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

    // 添加最大等待时间后备机制（10秒后强制显示）
    const maxWaitTime = 10000;
    const forceShowTimeout = setTimeout(() => {
      console.log('达到最大等待时间，强制显示页面');
      startFadeOut();
      cancelAnimationFrame(animationFrameId);
    }, maxWaitTime);

    window.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('load', handleLoad);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(forceShowTimeout);
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
