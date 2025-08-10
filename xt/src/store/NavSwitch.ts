// store.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 添加一个工具函数来根据屏幕宽度确定导航宽度
const getNavWidthByScreenSize = (screenWidth: number): string => {
  return screenWidth >= 768 ? '200px' : '0px';
};

// 添加一个函数来设置bg-filter CSS变量
const setBgFilter = (screenWidth: number, navWidth: string) => {
  const bgFilter = screenWidth < 768 && navWidth !== '0px' ? 'block' : 'none';
  document.documentElement.style.setProperty('--bg-filter', bgFilter);
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
      // 设置bg-filter
      setBgFilter(state.screenWidth, action.payload);
    },
    // 添加更新屏幕宽度的reducer
    updateScreenWidth: (state, action) => {
      state.screenWidth = action.payload;
      // 自动更新导航宽度
      state.navWidth = getNavWidthByScreenSize(action.payload);
      // 设置bg-filter
      setBgFilter(state.screenWidth, state.navWidth);
    },
    // 添加根据屏幕宽度设置导航宽度的reducer
    setResponsiveNavWidth: (state) => {
      state.navWidth = getNavWidthByScreenSize(state.screenWidth);
      // 设置bg-filter
      setBgFilter(state.screenWidth, state.navWidth);
    },
    // 添加路由变化时在小屏幕下关闭导航的reducer
    closeNavOnRouteChange: (state) => {
      if (state.screenWidth < 768) {
        state.navWidth = '0px';
        // 设置bg-filter
        setBgFilter(state.screenWidth, '0px');
      }
    }
  },
});

// 定义状态类型
interface NavState {
  nav: {
    screenWidth: number;
    navWidth: string;
  };
}

// 初始化bg-filter
export const initializeBgFilter = createAsyncThunk(
  'nav/initializeBgFilter',
  (_, { getState }) => {
    const { nav } = getState() as NavState;
    setBgFilter(nav.screenWidth, nav.navWidth);
  }
);

export const { setClass, setNavWidth, updateScreenWidth, setResponsiveNavWidth, closeNavOnRouteChange } = navSlice.actions;
export default navSlice.reducer;