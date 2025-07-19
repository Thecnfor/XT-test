'use client'
import { useState, useEffect } from 'react';
import "@/styles/components/header.scss";
import Checkbox from '@/components/uiverse/btnMenu';
import Text from '@/components/self/textUnderline';

export default function Header() {
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
    <div className={`header ${headerClasses}`}>
      <header>
        <div className='header-container'>
          <div className='header-logo'>
                      Xrak
            </div>
              <div className='header-nav'>
                <ul>
                  <li>
                    <Text text="首页" />
                  </li>
                  <li>
                    <Text text="项目" />
                  </li>
                  <li>
                    <Text text="联系" />
                  </li>
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