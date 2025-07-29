// store.js
import { configureStore, createSlice } from '@reduxjs/toolkit';

const navSlice = createSlice({
  name: 'nav',
  initialState: { activeClass: '' },
  reducers: {
    setClass: (state, action) => {
      state.activeClass = action.payload;
    },
  },
});

export const { setClass } = navSlice.actions;
export default navSlice.reducer;