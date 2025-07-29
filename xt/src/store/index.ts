import { configureStore } from '@reduxjs/toolkit';
import navSwitchReducer from './NavSwitch';

export const store = configureStore({
  reducer: {
    navSwitch: navSwitchReducer,
  },
});

export default store;