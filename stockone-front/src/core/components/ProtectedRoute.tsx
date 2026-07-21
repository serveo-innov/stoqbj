import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { all_routes } from '../../feature-module/router/all_routes';

interface ProtectedRouteProps {
  allowedRoles?: ('super_admin' | 'admin_shop' | 'gerant' | 'caissier')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated || !user) {
    return <Navigate to={all_routes.login} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={all_routes.dashboard} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
