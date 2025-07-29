'use client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import navReducer from '@/store/NavSwitch';

const store = configureStore({
  reducer: {
    nav: navReducer
  }
});

export default function Providers({ children }) {
  return <Provider store={store}>{children}</Provider>;
}