'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateScreenWidth, setResponsiveNavWidth } from '@/store/NavSwitch';

/**
 * 响应式导航宽度提供者组件
 * 用于在客户端监听屏幕宽度变化并更新导航宽度
 */
const ResponsiveNavWidthProvider = () => {
  const dispatch = useDispatch();
  const screenWidth = useSelector((state: any) => state.nav.screenWidth);

  // 初始化响应式导航宽度
  useEffect(() => {
    dispatch(setResponsiveNavWidth());
  }, [dispatch]);

  // 监听屏幕宽度变化
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      dispatch(updateScreenWidth(newWidth));
    };

    // 初始设置
    handleResize();

    // 添加事件监听
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [dispatch]);

  return null;
};

export default ResponsiveNavWidthProvider;