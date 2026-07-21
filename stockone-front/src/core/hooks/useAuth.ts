import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../redux/store';
import store from '../redux/store';
import { loginStart, loginSuccess, loginFailure, logout } from '../redux/authSlice';
import api from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { all_routes } from '../../feature-module/router/all_routes';

type AppDispatch = typeof store.dispatch;

export const useAuth = () => {
  const dispatch   = useDispatch<AppDispatch>();
  const navigate   = useNavigate();
  const authState  = useSelector((state: RootState) => state.auth);

  const login = async (email: string, password: string) => {
    dispatch(loginStart());
    try {
      const data = await api.post<{
        access_token: string;
        user: any;
        expires_at: string;
      }>('/auth/login', { email, password });

      dispatch(loginSuccess({ user: data.user, token: data.access_token }));

      if (data.user.role === 'super_admin') {
        navigate(all_routes.adminDashboard);
      } else if (data.user.role === 'caissier') {
        // Le caissier n'a pas accès à /reports/dashboard (reserve a
        // gerant/admin_shop/super_admin cote backend) — direction la caisse,
        // son outil de travail quotidien.
        navigate(all_routes.pos);
      } else {
        navigate(all_routes.dashboard);
      }

      return data;
    } catch (error: any) {
      dispatch(loginFailure(error.message || 'Erreur de connexion'));
      throw error;
    }
  };

  const logoutUser = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    finally {
      dispatch(logout());
      navigate(all_routes.login);
    }
  };

  const hasPermission = (permission: string): boolean => {
    return (authState.user?.permissions as any)?.[permission] ?? false;
  };

  const isSuperAdmin = () => authState.user?.role === 'super_admin';
  const isAdminShop  = () => authState.user?.role === 'admin_shop';
  const isGerant     = () => authState.user?.role === 'gerant';
  const isCaissier   = () => authState.user?.role === 'caissier';

  return {
    ...authState,
    login,
    logout: logoutUser,
    hasPermission,
    isSuperAdmin,
    isAdminShop,
    isGerant,
    isCaissier,
  };
};
