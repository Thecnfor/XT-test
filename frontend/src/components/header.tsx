'use client'
import { useState, useEffect } from 'react';
import "@/styles/components/header.scss";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 1);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const headerClasses = isScrolled ? 'header-fixed' : '';

  return (
    <div className={`header ${headerClasses}`}>
      <header>
        <div className='header-logo'>
            Xrak
        </div>
        <div className='header-nav'>
            <div>
                首页
            </div>
            <div>
                项目
            </div>
        </div>
        <div className='header-btn'>
            联系我
        </div>
      </header>
    </div>
  );
}