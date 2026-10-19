import React from 'react';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toggleMiniSidebar } from '../../redux/sidebarSlice';
import { clearActiveShop } from '../../redux/activeShopSlice';
import { useAuth } from '../../hooks/useAuth';
import { all_routes } from '../../../feature-module/router/all_routes';
import store from '../../redux/store';

type RootState = ReturnType<typeof store.getState>;

const AppHeader: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const activeShopId   = useSelector((state: RootState) => state.activeShop.activeShopId);
  const activeShopName = useSelector((state: RootState) => state.activeShop.activeShopName);

  const isSuperAdmin = user?.role === 'super_admin';
  const inShopContext = isSuperAdmin && !!activeShopId;

  // CORRECTIF : aucune relance n'existait nulle part avant la coupure
  // (ni pour l'essai gratuit, ni visible ailleurs que sur la page
  // Abonnement elle-meme, rarement visitee spontanement). Ce bandeau,
  // dans le header commun a toutes les pages, est l'endroit le plus
  // fiable pour etre vu. Limite a admin_shop : lui seul peut payer —
  // le montrer a gerant/caissier n'offrirait qu'un lien sans suite.
  const shopStatus = user?.shop?.status;
  const daysLeft = user?.shop?.days_until_expiry ?? 999;
  const showExpiryBanner = user?.role === 'admin_shop'
    && (shopStatus === 'trial' || shopStatus === 'active')
    && daysLeft <= 7;

  const handleExitShop = () => {
    dispatch(clearActiveShop());
    navigate(all_routes.adminDashboard);
  };

  return (
    <>
    <div className="header">
      <div className="d-flex align-items-center">
        <button
          className="btn btn-link p-0 text-dark"
          onClick={() => dispatch(toggleMiniSidebar())}
        >
          <i className="ti ti-menu-2" style={{fontSize:20}}/>
        </button>

        {inShopContext && (
          <div className="d-flex align-items-center gap-2" style={{
            background:'#fff7ed', border:'1px solid #FED7AA', borderRadius:8,
            padding:'6px 12px', marginLeft:16
          }}>
            <i className="ti ti-building-store" style={{color:'#F97316', fontSize:15}}/>
            <span className="fs-13" style={{color:'#1a1a1a'}}>
              Vous gérez : <b>{activeShopName}</b>
            </span>
            <button
              className="btn btn-sm"
              style={{background:'#1a1a1a', color:'#fff', borderRadius:6, fontSize:11, padding:'3px 10px'}}
              onClick={handleExitShop}
            >
              Quitter
            </button>
          </div>
        )}
      </div>

      <div className="d-flex align-items-center gap-3">
        <span className="fs-14 fw-600 text-dark">
          {user?.firstname} {user?.name}
        </span>
        <span className="badge" style={{background:'#fff7ed',color:'#EA580C',border:'1px solid #FED7AA',fontSize:11}}>
          {user?.role?.replace('_', ' ')}
        </span>
        <button
          className="btn btn-sm"
          style={{background:'#1a1a1a',color:'#fff',borderRadius:6}}
          onClick={logout}
        >
          <i className="ti ti-logout me-1"/>
          Déconnexion
        </button>
      </div>
    </div>

      {showExpiryBanner && (
        <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap"
          style={{
            background: daysLeft <= 1 ? '#fef2f2' : '#fffbeb',
            borderBottom: `1px solid ${daysLeft <= 1 ? '#fca5a5' : '#fde68a'}`,
            color: daysLeft <= 1 ? '#dc2626' : '#d97706',
            padding: '8px 16px', fontSize: 13,
          }}>
          <i className="ti ti-calendar-exclamation"/>
          <span>
            {shopStatus === 'trial' ? 'Votre essai gratuit se termine' : 'Votre abonnement expire'}
            {' '}dans <b>{daysLeft} jour{daysLeft > 1 ? 's' : ''}</b>.
          </span>
          <button
            className="btn btn-sm"
            style={{background: daysLeft <= 1 ? '#dc2626' : '#d97706', color:'#fff', borderRadius:6, fontSize:12, padding:'3px 12px'}}
            onClick={() => navigate(all_routes.subscription)}
          >
            {shopStatus === 'trial' ? "S'abonner" : 'Renouveler'}
          </button>
        </div>
      )}
    </>
  );
};

export default AppHeader;
