'use client'
import { useState, useEffect } from 'react';
import "@/styles/components/header.scss";
import clsx from 'clsx';

//按钮组件
import Checkbox from '@/components/uiverse/btnMenu';
import Text from '@/components/self/textUnderline';

//动画组件



export default function Header() {
  // 导航项数据，新增项只需添加对象即可自动排序timer
  const navItems: Array<{ text: string ,href:string }> = [
    { text: "首页" ,href:'home'},
    { text: "项目" ,href:'project'},
    { text: "联系" ,href:'contact'},
    // 添加新导航项示例：{ text: "关于" }
  ];

  // 滚动监听
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const headerClasses = isScrolled ? 'header-fixed' : '';


  return (
    <div className={clsx('header',headerClasses)}>
      <header>
        <div className='header-container'>
          <div className='header-logo'>
              <span>电脑行</span><div>.XT</div>
          </div>
          <div className='header-nav'>
            <ul>
              {navItems.map((item, index) => (
                <Text key={index} text={item.text} index={index} href={item.href} />
              ))}
            </ul>
          </div>
        </div>
        <div className='header-btn'>
          <Checkbox />
        </div>
      </header>
    </div>
  );
}