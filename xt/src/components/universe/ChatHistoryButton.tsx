import React from 'react';
import styled from 'styled-components';
import { useState, useEffect } from 'react';

const SwitchChat = () => {
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    // 更新全局 CSS 变量
    document.documentElement.style.setProperty('--nav-width', isChecked ? '200px' : '0');
  }, [isChecked]);

  const handleChange = () => {
    setIsChecked(!isChecked);
  };

  return (
    <StyledWrapper>
      <div className='chat-bg'></div>
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
