'use client'

import React, { useState, useEffect, memo } from 'react';
import styled from 'styled-components';


// 内联样式以确保优先加载
const styles = {
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'var(--bg-color)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'opacity 1s ease-out, transform 1s ease-out, filter 1s ease-out, z-index 0s linear 1s',
  },
  loadingContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
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
    <StyledWrapper>
      <span className="loader" />
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .loader {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 6rem;
    margin-top: 3rem;
    margin-bottom: 3rem;
  }

  .loader:before,
    .loader:after {
    content: "";
    position: absolute;
    border-radius: 50%;
    animation: pulsOut 1.8s ease-in-out infinite;
    filter: drop-shadow(0 0 1rem rgba(255, 255, 255, 0.75));
  }

  .loader:before {
    width: 100%;
    padding-bottom: 100%;
    box-shadow: inset 0 0 0 1rem #fff;
    animation-name: pulsIn;
  }

  .loader:after {
    width: calc(100% - 2rem);
    padding-bottom: calc(100% - 2rem);
    box-shadow: 0 0 0 0 #fff;
  }

  @keyframes pulsIn {
    0% {
      box-shadow: inset 0 0 0 1rem #fff;
      opacity: 1;
    }

    50%, 100% {
      box-shadow: inset 0 0 0 0 #fff;
      opacity: 0;
    }
  }

  @keyframes pulsOut {
    0%, 50% {
      box-shadow: 0 0 0 0 #fff;
      opacity: 0;
    }

    100% {
      box-shadow: 0 0 0 1rem #fff;
      opacity: 1;
    }
  }`;

const LoadingScreen = () => {
  // 检查是否已经加载过，如果是则直接跳过加载画面
  // 确保只在客户端环境中使用localStorage
  const [isLoading, setIsLoading] = useState(() => {
    // 在服务器端或浏览器不支持localStorage时默认显示加载画面
    if (typeof window === 'undefined' || !window.localStorage) {
      return true;
    }
    return !localStorage.getItem('hasLoaded');
  });
  const [isFadingOut, setIsFadingOut] = useState(false);

  // 优化加载检测逻辑
  useEffect(() => {
    // 检查关键CSS是否已加载
    const checkCriticalStyles = () => {
      // 检查body是否有来自globals.css的类名
      return document.body.classList.contains('antialiased');
    };

    // 立即检查
    if (checkCriticalStyles()) {
      startFadeOut();
      return;
    }

    // 使用requestAnimationFrame进行高效检查
    let animationFrameId: number;

    const checkStyles = () => {
      if (checkCriticalStyles()) {
        startFadeOut();
        cancelAnimationFrame(animationFrameId);
      } else {
        animationFrameId = requestAnimationFrame(checkStyles);
      }
    };

    animationFrameId = requestAnimationFrame(checkStyles);

    // 监听load事件作为最终后备
    const handleLoad = () => {
      startFadeOut();
      cancelAnimationFrame(animationFrameId);
      // 标记为已加载 (确保在客户端环境中)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('hasLoaded', 'true');
      }
    };

    window.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('load', handleLoad);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 开始淡出动画
  const startFadeOut = () => {
    setIsFadingOut(true);
    // 动画完成后隐藏组件
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  if (!isLoading) return null;

  // 合并基础样式和动画样式
  const overlayStyle = {
    ...styles.loadingOverlay,
    ...(isFadingOut ? styles.fadingOut : {}),
  };

  // 内容缩放动画
  const contentStyle = {
    ...styles.loadingContent,
    transform: isFadingOut ? 'scale(0)' : 'scale(1)',
  };

  return (
    <div style={overlayStyle}>
      <div style={contentStyle}>
        <Loader />
      </div>
    </div>
  );
};


export default memo(LoadingScreen);
