import React from 'react';
import styled from 'styled-components';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setNavWidth } from '@/store/NavSwitch';
import { usePathname } from 'next/navigation';

const SwitchChat = () => {
  const pathname = usePathname();
  const dispatch = useDispatch();
  // 假设存在 RootState 类型来表示 store 的状态
  type RootState = {
    nav: {
      navWidth: string;
    };
  };
  const navWidth = useSelector((state: RootState) => state.nav.navWidth);
  const [isChecked, setIsChecked] = useState(navWidth === '300px');

  useEffect(() => {
    // 当 navWidth 变化时，更新 isChecked 状态
    setIsChecked(navWidth === '300px');
  }, [navWidth]);

  const handleChange = () => {
    const newWidth = isChecked ? '0' : '300px';
    setIsChecked(!isChecked);
    dispatch(setNavWidth(newWidth));
  };

  // 只在根目录显示
  if (pathname !== '/') {
    return null;
  }

  return (
    <StyledWrapper>
      <div>
        <input id="checkbox" type="checkbox" checked={isChecked} onChange={handleChange} />
        <label className="toggle" htmlFor="checkbox">
          <div id="bar1" className="bars" />
          <div id="bar2" className="bars" />
        </label>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  @media (min-width: 768px) {
    display: none;
  }
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 1cap;
  padding-top: 4px;
  #checkbox {
    display: none;
  }

  .toggle {
    position: relative;
    width: 20px;
    height: 20px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 8px;
    transition-duration: .5s;
  }

  .bars {
    width: 100%;
    height: 3px;
    background-color: var(--text-color);
    border-radius: 4px;
  }

  #bar2 {
    transition-duration: .8s;
    width: 70%;
  }

  #bar1 {
    width: 100%;
  }


  #checkbox:checked + .toggle .bars {
    position: absolute;
    transition-duration: .5s;
  }

  #checkbox:checked + .toggle #bar2 {
    transform: scaleX(0);
    transition-duration: .1s;
  }

  #checkbox:checked + .toggle #bar1 {
    width: 100%;
    transform: rotate(45deg);
    transition-duration: .5s;
  }

  #checkbox:checked + .toggle #bar2 {
    width: 100%;
    transform: rotate(-45deg);
    transition-duration: .5s;
  }

  #checkbox:checked + .toggle {
    transition-duration: .5s;
    transform: rotate(180deg);
  }`;

export default SwitchChat;
