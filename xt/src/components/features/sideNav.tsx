'use client'

import navLinks from '@/hooks/docs/links';
import Link from 'next/link';
import styled from 'styled-components';



export default function SideNav() {
  return (
    <>
    <StyledUl>
        {Object.entries(navLinks).map(([name, path]) => (
            <StyledLi key={name}>
                <StyledLink href={path}>
                    <StyledDiv>
                        <StyledSpan>{name}</StyledSpan>
                        <StyledSvg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-200"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M5 12l14 0" strokeDasharray="50%" strokeDashoffset="50%"></path><path d="M13 18l6 -6"></path><path d="M13 6l6 6"></path></StyledSvg>
                    </StyledDiv>
                </StyledLink>
            </StyledLi>
        ))}
    </StyledUl>
    <label className='side' htmlFor='side'>
        <input type='checkbox' id='side' aria-label="Side navigation toggle" />
    </label>
    </>
  )
}

const StyledUl = styled.ul`
    width: 100%;
`;

const StyledLi = styled.li`
    width: 100%;
`;

const StyledDiv = styled.div`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const StyledLink = styled(Link)`
    width: 100%;
`;

const StyledSvg = styled.svg`
    margin-right: 12px;
    opacity: 1;
`;

const StyledSpan = styled.span`
    
`;
