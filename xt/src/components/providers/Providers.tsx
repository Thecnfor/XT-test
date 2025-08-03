'use client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import navReducer from '@/store/NavSwitch';
import type { ReactNode } from 'react';

const store = configureStore({
  reducer: {
    navSwitch: navReducer
  }
});

export default function Providers({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}