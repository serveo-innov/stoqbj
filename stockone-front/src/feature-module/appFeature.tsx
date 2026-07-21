import React, { useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { all_routes } from './router/all_routes';
import AppHeader from '../core/common/header/header';
import AppSidebar from '../core/common/sidebar/sidebar';
import store from '../core/redux/store';

type RootState = ReturnType<typeof store.getState>;

const AppFeature: React.FC = () => {
  const location        = useLocation();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { miniSidebar } = useSelector((state: RootState) => state.sidebarSlice);

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to={all_routes.login} replace />;
  }

  return (
    <div className={`main-wrapper ${miniSidebar ? 'mini-sidebar' : ''}`}>
      <AppSidebar />
      <div className="page-wrapper" style={{marginLeft: miniSidebar ? 70 : 260}}>
        <AppHeader />
        <div className="content">
          <Outlet />
        </div>
      </div>
      <div className="sidebar-overlay"></div>
    </div>
  );
};

export default AppFeature;
