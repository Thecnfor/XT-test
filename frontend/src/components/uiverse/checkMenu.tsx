import React from 'react';
import styled from 'styled-components';

const Checkbox = () => {
  return (
    <StyledWrapper>
      <label className="main">
        Menu
        <input className="inp" defaultChecked type="checkbox" />
        <div className="bar">
          <span className="top bar-list" />
          <span className="middle bar-list" />
          <span className="bottom bar-list" />
        </div>
        <section className="menu-container">
          <div className="menu-list">Food</div>
          <div className="menu-list">Entertainment</div>
          <div className="menu-list">Blog</div>
          <div className="menu-list">Location</div>
        </section>
      </label>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .main > .inp {
    display: none;
  }
  .main {
    font-weight: 800;
    color: white;
    background-color: darkviolet;
    padding: 3px 15px;
    border-radius: 10px;

    display: flex;
    align-items: center;
    height: 2.5rem;
    width: 12rem;
    position: relative;
    cursor: pointer;
    justify-content: space-between;
  }

  .arrow {
    height: 34%;
    aspect-ratio: 1;
    margin-block: auto;
    position: relative;
    display: flex;
    justify-content: center;
    transition: all 0.3s;
  }

  .arrow::after,
  .arrow::before {
    content: "";
    position: absolute;
    background-color: white;
    height: 100%;
    width: 2.5px;
    border-radius: 500px;
    transform-origin: bottom;
  }

  .arrow::after {
    transform: rotate(35deg) translateX(-0.5px);
  }
  .arrow::before {
    transform: rotate(-35deg) translateX(0.5px);
  }

  .main > .inp:checked + .arrow {
    transform: rotateX(180deg);
  }

  .menu-container {
    background-color: white;
    color: darkviolet;
    border-radius: 10px;
    position: absolute;
    width: 100%;
    left: 0;
    top: 130%;
    overflow: hidden;
    clip-path: inset(0% 0% 0% 0% round 10px);
    transition: all 0.4s;
  }

  .menu-list {
    --delay: 0.4s;
    --trdelay: 0.15s;
    padding: 8px 10px;
    border-radius: inherit;
    transition: background-color 0.2s 0s;
    position: relative;
    transform: translateY(30px);
    opacity: 0;
  }

  .menu-list::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    height: 1px;
    background-color: rgba(0, 0, 0, 0.3);
    width: 95%;
  }

  .menu-list:hover {
    background-color: rgb(223, 223, 223);
  }

  .inp:checked ~ .menu-container {
    clip-path: inset(10% 50% 90% 50% round 10px);
  }

  .inp:not(:checked) ~ .menu-container .menu-list {
    transform: translateY(0);
    opacity: 1;
  }

  .inp:not(:checked) ~ .menu-container .menu-list:nth-child(1) {
    transition:
      transform 0.4s var(--delay),
      opacity 0.4s var(--delay);
  }

  .inp:not(:checked) ~ .menu-container .menu-list:nth-child(2) {
    transition:
      transform 0.4s calc(var(--delay) + (var(--trdelay) * 1)),
      opacity 0.4s calc(var(--delay) + (var(--trdelay) * 1));
  }

  .inp:not(:checked) ~ .menu-container .menu-list:nth-child(3) {
    transition:
      transform 0.4s calc(var(--delay) + (var(--trdelay) * 2)),
      opacity 0.4s calc(var(--delay) + (var(--trdelay) * 2));
  }

  .inp:not(:checked) ~ .menu-container .menu-list:nth-child(4) {
    transition:
      transform 0.4s calc(var(--delay) + (var(--trdelay) * 3)),
      opacity 0.4s calc(var(--delay) + (var(--trdelay) * 3));
  }

  .bar-inp {
    -webkit-appearance: none;
    display: none;
    visibility: hidden;
  }

  .bar {
    display: flex;
    height: 50%;
    width: 20px;
    flex-direction: column;
    gap: 3px;
  }

  .bar-list {
    --transform: -25%;
    display: block;
    width: 100%;
    height: 3px;
    border-radius: 50px;
    background-color: white;
    transition: all 0.4s;
    position: relative;
  }

  .inp:not(:checked) ~ .bar > .top {
    transform-origin: top right;
    transform: translateY(var(--transform)) rotate(-45deg);
  }

  .inp:not(:checked) ~ .bar > .middle {
    transform: translateX(-50%);
    opacity: 0;
  }

  .inp:not(:checked) ~ .bar > .bottom {
    transform-origin: bottom right;
    transform: translateY(calc(var(--transform) * -1)) rotate(45deg);
  }`;

export default Checkbox;
