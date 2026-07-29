import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import store from '../redux/store';
import { all_routes } from '../../feature-module/router/all_routes';

type RootState = ReturnType<typeof store.getState>;

/**
 * Le Super Admin a acces a toutes les rubriques (cahier des charges : "acces
 * a toutes les donnees sans scope"), sans exception et sans que le menu ne
 * soit jamais cache. Mais les pages operationnelles (Produits, Stock, Ventes,
 * Credits...) portent sur UNE boutique precise : ce garde-fou s'affiche a la
 * place de la page si aucune boutique n'a encore ete choisie, plutot que de
 * laisser la page planter en appelant l'API sans shop_id.
 */
const RequireActiveShop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user          = useSelector((state: RootState) => state.auth.user);
  const activeShopId  = useSelector((state: RootState) => state.activeShop.activeShopId);

  const needsShopSelection = user?.role === 'super_admin' && !activeShopId;

  if (needsShopSelection) {
    return (
      <div className="text-center py-5">
        <i className="ti ti-building-store d-block mb-3" style={{ fontSize: 48, color: '#d1d5db' }} />
        <h5 className="fw-700 mb-2">Choisissez une boutique</h5>
        <p className="text-muted mb-4" style={{ maxWidth: 420, margin: '0 auto 24px' }}>
          Cette page concerne une boutique précise. Sélectionnez celle que vous souhaitez administrer
          depuis la liste des boutiques.
        </p>
        <Link
          to={all_routes.adminShops}
          className="btn d-inline-flex align-items-center gap-2"
          style={{ background: '#F97316', color: '#fff', borderRadius: 8, padding: '10px 24px', fontWeight: 600, textDecoration: 'none' }}
        >
          <i className="ti ti-building-store" />
          Aller à Boutiques
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireActiveShop;
