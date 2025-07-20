import Router from 'next/router';
import { useEffect } from 'react';
//-----------------------------------函数-------------------------------------//
export default function PageTracker() {
  useEffect(() => {
    // 路由开始切换时触发
    const handleRouteChange = (url:string) => {

      console.log('路由改变了:', url);
      // 这里可以添加分析代码
    };
    
    // 路由切换完成时触发
    const handleRouteComplete = (url:string) => {

      console.log('路由完成:', url);
    };
    
    // 添加事件监听器
    Router.events.on('routeChangeStart', handleRouteChange);
    Router.events.on('routeChangeComplete', handleRouteComplete);
    
    // 组件卸载时移除监听器，防止内存泄漏
    return () => {
      Router.events.off('routeChangeStart', handleRouteChange);
      Router.events.off('routeChangeComplete', handleRouteComplete);
    };
  }, []);
  
  return null; // 这是一个只用于监听的组件，不需要渲染任何UI
};

//---------------------------------------------------------------------------//
