import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: number;
  name: string;
  firstname: string;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'admin_shop' | 'gerant' | 'caissier';
  is_active: boolean;
  last_login_at: string | null;
  permissions: {
    can_manage_catalogue: boolean;
    can_view_full_reports: boolean;
    can_adjust_prices: boolean;
    can_manage_users: boolean;
    can_manage_shop_settings: boolean;
    can_validate_stock_adj: boolean;
    can_manage_shops: boolean;
  };
  shop?: {
    id: number;
    shop_name: string;
    commercial_name: string | null;
    logo_path: string | null;
    brand_color: string;
    status: string;
    days_until_expiry: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user:            JSON.parse(localStorage.getItem('stockone_user') || 'null'),
  token:           localStorage.getItem('stockone_token'),
  isAuthenticated: !!localStorage.getItem('stockone_token'),
  loading:         false,
  error:           null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error   = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.loading         = false;
      state.isAuthenticated = true;
      state.user            = action.payload.user;
      state.token           = action.payload.token;
      state.error           = null;
      localStorage.setItem('stockone_token', action.payload.token);
      localStorage.setItem('stockone_user',  JSON.stringify(action.payload.user));
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error   = action.payload;
    },
    logout: (state) => {
      state.user            = null;
      state.token           = null;
      state.isAuthenticated = false;
      state.error           = null;
      localStorage.removeItem('stockone_token');
      localStorage.removeItem('stockone_user');
    },
    updateUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      localStorage.setItem('stockone_user', JSON.stringify(action.payload));
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, updateUser } = authSlice.actions;
export type { User, AuthState };
export default authSlice.reducer;
