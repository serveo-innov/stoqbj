import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface ActiveShopState {
  activeShopId: number | null;
  activeShopName: string | null;
}

const initialState: ActiveShopState = {
  activeShopId:   JSON.parse(localStorage.getItem('stockone_active_shop_id') || 'null'),
  activeShopName: localStorage.getItem('stockone_active_shop_name'),
};

const activeShopSlice = createSlice({
  name: 'activeShop',
  initialState,
  reducers: {
    setActiveShop: (state, action: PayloadAction<{ id: number; name: string }>) => {
      state.activeShopId   = action.payload.id;
      state.activeShopName = action.payload.name;
      localStorage.setItem('stockone_active_shop_id', JSON.stringify(action.payload.id));
      localStorage.setItem('stockone_active_shop_name', action.payload.name);
    },
    clearActiveShop: (state) => {
      state.activeShopId   = null;
      state.activeShopName = null;
      localStorage.removeItem('stockone_active_shop_id');
      localStorage.removeItem('stockone_active_shop_name');
    },
  },
});

export const { setActiveShop, clearActiveShop } = activeShopSlice.actions;
export type { ActiveShopState };
export default activeShopSlice.reducer;
