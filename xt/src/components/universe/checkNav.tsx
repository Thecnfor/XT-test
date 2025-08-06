'use client'

// 移除未使用的clsx导入
import Link from 'next/link';
import React, { useState } from 'react';
import styled from 'styled-components';
import navLinks from '@/lib/links';

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
    <StyledBackdrop $isVisible={isChecked} />
    <StyledShowMore $isVisible={isChecked}>
      <StyledNav>
        <StyledUl key={isChecked ? 'checked' : 'unchecked'}>
            {Object.entries(navLinks).map(([name, link], index) => (
              isChecked ? (
                <StyledLiIn key={`${name}-${isChecked}`} $index={index}>
                  <StyledLinkContainer>
                    <StyledLink href={link.path}>
                      {name}
                    </StyledLink>
                  </StyledLinkContainer>
                </StyledLiIn>
              ) : (
                <StyledLiOut key={`${name}-${isChecked}`} $index={index}>
                  <StyledLinkContainer>
                    <StyledLink href={link.path}>
                      {name}
                    </StyledLink>
                  </StyledLinkContainer>
                </StyledLiOut>
              )
            ))}
        </StyledUl>
      </StyledNav>
    </StyledShowMore>
    </>
  );
}

const StyledBackdrop =styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100dvw;
  height: 100dvh;
  @media (prefers-color-scheme: dark) {
    background-color: rgba(0, 0, 0, 0.66);
  }
  background-color: rgba(255, 255, 255, 0.82);
  z-index: ${({ $isVisible }) => $isVisible ? '74' : '0'};
  opacity: ${({ $isVisible }) => $isVisible ? 1 : 0};
  pointer-events: ${({ $isVisible }) => $isVisible ? 'auto' : 'none'};
  transition: all .8s cubic-bezier(0.22, 1, 0.36, 1);
  backdrop-filter: blur(8000px);
`

const StyledShowMore = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100dvw;
  height: ${({ $isVisible }) => $isVisible ? '100svh' : '0'};
  @media (prefers-color-scheme: dark) {
    background-color: rgba(0, 0, 0, 0.66);
  }
  background-color: rgba(255, 255, 255, 0.82);
  filter: blur(5000);
  z-index: 75;
  opacity: ${({ $isVisible }) => $isVisible ? 1 : 0};
  overflow: hidden;
  will-change: height, opacity, transform;
  transition: opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1), height 1.2s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: ${({ $isVisible }) => $isVisible ? 'auto' : 'none'};
  backdrop-filter: blur(8px);
  @media (min-width: 768px) {
    display: none;
  }
`;

const StyledNav = styled.nav`
  height: 100%;
  margin-top: 3rem;
  margin-left: 2rem;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
`;

const StyledUl = styled.ul`
  list-style: none;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: space-around;
  padding-left: 0.3rem;
`;

const StyledLiIn = styled.li<{ $index: number }>`
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInDown 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: ${({ $index }) => 0.05 * $index}s;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledLiOut = styled.li<{ $index: number }>`
  opacity: 1;
  transform: translateY(0);
  animation: fadeOutUp 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: ${({ $index }) => 0.04 * (7 - $index)}s; /* 8个链接，最大索引为7 */
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  @keyframes fadeOutUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }

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
  width: 100%;
  height: 100%;
`;

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0.5rem 0.5rem 0.5rem 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 600;
  color: var(--text-color);
  text-decoration: none;
  position: relative;
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  text-align: center;
  border-radius: 8px;
  width: 100%;
  height: 100%;
`;

const StyledWrapper = styled.div`
  z-index: 1000;
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
