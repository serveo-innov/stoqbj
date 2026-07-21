import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { authRoutes, publicRoutes } from './router.link';
import AppFeature from '../appFeature';
import AuthFeature from '../authFeature';
import { all_routes } from './all_routes';
import store from '../../core/redux/store';

type RootState = ReturnType<typeof store.getState>;

// La redirection racine doit tenir compte du rôle : un super_admin n'a pas
// de shop_id et ne peut pas utiliser le tableau de bord boutique classique
// (qui appelle des routes API exigeant un shop_id).
const RootRedirect: React.FC = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to={all_routes.login} replace />;
  }
  if (user?.role === 'super_admin') {
    return <Navigate to={all_routes.adminDashboard} replace />;
  }
  return <Navigate to={all_routes.dashboard} replace />;
};

const ALLRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Redirection racine — sensible au rôle (voir RootRedirect) */}
      <Route path="/" element={<RootRedirect />} />

      {/* Routes protégées (avec layout sidebar/header) */}
      <Route element={<AppFeature />}>
        {publicRoutes.map((route, idx) => (
          <Route path={route.path} element={route.element} key={idx} />
        ))}
      </Route>

      {/* Routes auth (login, error) */}
      <Route element={<AuthFeature />}>
        {authRoutes.map((route, idx) => (
          <Route path={route.path} element={route.element} key={idx} />
        ))}
      </Route>
    </Routes>
  );
};

export default ALLRoutes;
