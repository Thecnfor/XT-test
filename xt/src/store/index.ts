import { configureStore } from '@reduxjs/toolkit';
import {
  useSelector,
  TypedUseSelectorHook
} from 'react-redux';
import navSwitchReducer from './NavSwitch';

export const store = configureStore({
  reducer: {
    navSwitch: navSwitchReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store;