import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

const AuthFeature: React.FC = () => {
  const location  = useLocation();
  const isError   = ['/error-404', '/error-500'].includes(location.pathname);

  if (isError) return <Outlet />;

  return (
    <div className="main-wrapper authentication-wrapper">
      <Outlet />
    </div>
  );
};

export default AuthFeature;
