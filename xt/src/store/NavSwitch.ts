// store.js
import { createSlice } from '@reduxjs/toolkit';

// 添加一个工具函数来根据屏幕宽度确定导航宽度
const getNavWidthByScreenSize = (screenWidth: number): string => {
  return screenWidth >= 768 ? '200px' : '0px';
};

const navSlice = createSlice({
  name: 'nav',
  initialState: { 
    activeClass: '', 
    navWidth: '200px',
    // 添加屏幕宽度状态
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1200
  },
  reducers: {
    setClass: (state, action) => {
      state.activeClass = action.payload;
    },
    setNavWidth: (state, action) => {
      state.navWidth = action.payload;
    },
    // 添加更新屏幕宽度的reducer
    updateScreenWidth: (state, action) => {
      state.screenWidth = action.payload;
      // 自动更新导航宽度
      state.navWidth = getNavWidthByScreenSize(action.payload);
    },
    // 添加根据屏幕宽度设置导航宽度的reducer
    setResponsiveNavWidth: (state) => {
      state.navWidth = getNavWidthByScreenSize(state.screenWidth);
    }
  },
});

export const { setClass, setNavWidth, updateScreenWidth, setResponsiveNavWidth } = navSlice.actions;
export default navSlice.reducer;