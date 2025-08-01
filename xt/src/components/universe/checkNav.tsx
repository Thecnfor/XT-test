'use client'

import clsx from 'clsx';
import Link from 'next/link';
import React, { useState } from 'react';
import styled from 'styled-components';
import navLinks from '@/hooks/docs/links';

const CheckNav = () => {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <>
    <StyledWrapper>
      <label className="hamburger">
        <input type="checkbox" id="hamburger-checkbox" aria-label="Hamburger menu toggle" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} />
        <svg viewBox="0 0 32 32">
          <path className="line line-top-bottom" d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22" />
          <path className="line" d="M7 16 27 16" />
        </svg>
      </label>
    </StyledWrapper>
    <StyledShowMore $isVisible={isChecked}>
      <StyledNav>
        <StyledUl key={isChecked ? 'checked' : 'unchecked'}>
            {Object.entries(navLinks).map(([name, path], index) => (
              <StyledLi key={`${name}-${isChecked}`} $index={index}>
                <StyledLinkContainer>
                  <StyledLink href={path}>
                    {name}
                  </StyledLink>
                </StyledLinkContainer>
              </StyledLi>
            ))}
        </StyledUl>
      </StyledNav>
    </StyledShowMore>
    </>
  );
}

const StyledShowMore = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 64px;
  left: 0;
  width: 100dvw;
  height: ${({ $isVisible }) => $isVisible ? 'calc(100svh - 64px)' : '0'};
  @media (prefers-color-scheme: dark) {
    background-color: rgba(0, 0, 0, 0.95);
  }
  background-color: rgba(255, 255, 255, 0.98);
  z-index: 75;
  opacity: ${({ $isVisible }) => $isVisible ? 1 : 0};
  overflow: hidden;
  will-change: height, opacity, transform;
  transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1), height 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: ${({ $isVisible }) => $isVisible ? 'auto' : 'none'};
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  @media (min-width: 768px) {
    display: none;
  }
`;

const StyledNav = styled.nav`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledUl = styled.ul`
  list-style: none;
  padding: 0 2rem;
  margin: 0;
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  justify-content: space-around;
`;

const StyledLi = styled.li<{ $index: number }>`
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInDown 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: ${({ $index }) => 0.12 * $index}s;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const StyledLinkContainer = styled.div`
  position: relative;
`;

const StyledLink = styled(Link)`
  display: block;
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: 500;
  color: var(--text-color);
  text-decoration: none;
  padding: 1rem;
  position: relative;
  transition: transform 0.3s ease;
  text-align: center;
  border-radius: 8px;
  width: 100%;
`;

const StyledWrapper = styled.div`
  .hamburger {
    cursor: pointer;
  }

  .hamburger input {
    display: none;
  }

  .hamburger svg {
    /* The size of the SVG defines the overall size */
    height: 2em;
    /* Define the transition for transforming the SVG */
    transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .line {
    fill: none;
    stroke: var(--text-color);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 3;
    /* Define the transition for transforming the Stroke */
    transition:
      stroke-dasharray 600ms cubic-bezier(0.4, 0, 0.2, 1),
      stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .line-top-bottom {
    stroke-dasharray: 12 63;
  }

  .hamburger input:checked + svg {
    transform: rotate(-45deg);
  }

  .hamburger input:checked + svg .line-top-bottom {
    stroke-dasharray: 20 300;
    stroke-dashoffset: -32.42;
  }`;

export default CheckNav;

// 链接已统一管理到 @/hooks/docs/links.ts 文件中
