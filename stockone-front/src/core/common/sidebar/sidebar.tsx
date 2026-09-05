import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { all_routes } from '../../../feature-module/router/all_routes';
import store from '../../redux/store';
import logo from '../../../assets/logo-64.png';

type RootState = ReturnType<typeof store.getState>;

const AppSidebar: React.FC = () => {
  const location    = useLocation();
  const miniSidebar = useSelector((state: RootState) => state.sidebarSlice.miniSidebar);
  const user        = useSelector((state: RootState) => state.auth.user);
  const activeShopId = useSelector((state: RootState) => state.activeShop.activeShopId);
  const isActive    = (path: string) => location.pathname === path;
  const w           = miniSidebar ? 70 : 260;
  const isSuperAdmin = user?.role === 'super_admin';
  const isCaissier    = user?.role === 'caissier';

  // Le caissier n'a pas acces (cote backend, groupe de role gerant+) a :
  // catalogue (produits/categories/fournisseurs), debiteurs, rapports,
  // alertes IA (suggestions de prix). Lui montrer ces liens le menerait
  // droit vers "Acces refuse. Permissions insuffisantes."
  const canSeeCatalogue = !isCaissier;
  const canSeeDebtors   = !isCaissier;
  const canSeeReports   = !isCaissier;

  return (
    <div style={{
      position:'fixed', top:0, left:0, height:'100vh', width:w,
      background:'#1a1a1a', zIndex:1000, overflowY:'auto',
      transition:'width 0.2s ease', overflowX:'hidden'
    }}>
      {/* Logo */}
      <div style={{padding:'16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:10}}>
        <div style={{
          width:36, height:36, borderRadius:8,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden'
        }}>
          <img src={logo} alt="Stoq" style={{width:'100%', height:'100%', objectFit:'contain'}}/>
        </div>
        {!miniSidebar && (
          <span style={{color:'#fff', fontWeight:800, fontSize:18, whiteSpace:'nowrap'}}>
            Stoq<span style={{color:'#F97316'}}>.bj</span>
          </span>
        )}
      </div>

      {/* Menu */}
      <nav style={{padding:'8px'}}>
        {/* Le caissier n'a pas acces a /reports/dashboard : pas de lien
            Tableau de bord pour lui, la Caisse POS est son point d'entree. */}
        {!isCaissier && (
          <SLink to={isSuperAdmin && !activeShopId ? all_routes.adminDashboard : all_routes.dashboard}
                 icon="ti-layout-dashboard" label="Tableau de bord" mini={miniSidebar}
                 active={isActive(all_routes.dashboard) || isActive(all_routes.adminDashboard)}/>
        )}

        <SLink to={all_routes.pos}           icon="ti-shopping-cart"    label="Caisse POS"      mini={miniSidebar} active={isActive(all_routes.pos)}/>
        <SLink to={all_routes.salesList}     icon="ti-receipt"          label="Ventes"          mini={miniSidebar} active={isActive(all_routes.salesList)}/>

        {canSeeCatalogue && (
          <>
            <Divider label="Catalogue" mini={miniSidebar}/>
            <SLink to={all_routes.products}      icon="ti-package"          label="Produits"        mini={miniSidebar} active={isActive(all_routes.products)}/>
            <SLink to={all_routes.categories}    icon="ti-category"         label="Catégories"      mini={miniSidebar} active={isActive(all_routes.categories)}/>
            <SLink to={all_routes.suppliers}     icon="ti-truck"            label="Fournisseurs"    mini={miniSidebar} active={isActive(all_routes.suppliers)}/>
          </>
        )}

        <Divider label="Stock" mini={miniSidebar}/>
        <SLink to={all_routes.stockEntry}    icon="ti-arrow-down-circle" label="Entrée stock"   mini={miniSidebar} active={isActive(all_routes.stockEntry)}/>
        <SLink to={all_routes.stockMovements}icon="ti-arrows-exchange"   label="Mouvements"     mini={miniSidebar} active={isActive(all_routes.stockMovements)}/>
        <SLink to={all_routes.stockAlerts}   icon="ti-bell"             label="Alertes stock"   mini={miniSidebar} active={isActive(all_routes.stockAlerts)}/>
        {(isSuperAdmin || user?.permissions?.can_validate_stock_adj) && (
          <SLink to={all_routes.inventory}   icon="ti-clipboard-list"   label="Inventaire"      mini={miniSidebar} active={isActive(all_routes.inventory)}/>
        )}

        <Divider label="Finance" mini={miniSidebar}/>
        <SLink to={all_routes.credits}       icon="ti-credit-card"      label="Crédits"         mini={miniSidebar} active={isActive(all_routes.credits)}/>
        {canSeeDebtors && (
          <SLink to={all_routes.debtors}     icon="ti-users"            label="Débiteurs"       mini={miniSidebar} active={isActive(all_routes.debtors)}/>
        )}

        {canSeeReports && (
          <>
            <Divider label="Rapports" mini={miniSidebar}/>
            <SLink to={all_routes.reports}       icon="ti-chart-bar"        label="Rapports"        mini={miniSidebar} active={isActive(all_routes.reports)}/>
            <SLink to={all_routes.alerts}        icon="ti-sparkles"         label="Alertes & IA"      mini={miniSidebar} active={isActive(all_routes.alerts)}/>
          </>
        )}

        {(isSuperAdmin || user?.permissions?.can_manage_users) && (
          <>
            <Divider label="Admin" mini={miniSidebar}/>
            <SLink to={all_routes.users}     icon="ti-user-cog"         label="Utilisateurs"    mini={miniSidebar} active={isActive(all_routes.users)}/>
          </>
        )}

        {/* Paramètres / Abonnement : self-service propre à l'Admin Boutique,
            non pertinent pour le Super Admin qui agit via Admin > Boutiques */}
        {!isSuperAdmin && user?.permissions?.can_manage_shop_settings && (
          <>
            <SLink to={all_routes.settings}    icon="ti-settings"         label="Paramètres"      mini={miniSidebar} active={isActive(all_routes.settings)}/>
            <SLink to={all_routes.subscription} icon="ti-credit-card-pay" label="Abonnement"      mini={miniSidebar} active={isActive(all_routes.subscription)}/>
          </>
        )}

        {isSuperAdmin && (
          <>
            <Divider label="Super Admin" mini={miniSidebar}/>
            <SLink to={all_routes.adminShops} icon="ti-building-store"  label="Boutiques"       mini={miniSidebar} active={isActive(all_routes.adminShops)}/>
            <SLink to={all_routes.adminStats} icon="ti-chart-pie"       label="Statistiques"    mini={miniSidebar} active={isActive(all_routes.adminStats)}/>
          </>
        )}

        {/* Profil */}
        <Divider label="" mini={miniSidebar}/>
        <SLink to={all_routes.myProfile}     icon="ti-user-circle"      label="Mon profil"      mini={miniSidebar} active={isActive(all_routes.myProfile)}/>
      </nav>
    </div>
  );
};

// ── Composants internes ──────────────────────────────────

interface SLinkProps {
  to: string; icon: string; label: string; mini: boolean; active: boolean;
}

const SLink: React.FC<SLinkProps> = ({ to, icon, label, mini, active }) => (
  <Link
    to={to}
    title={label}
    style={{
      display:'flex', alignItems:'center', gap:10,
      padding: mini ? '10px 16px' : '8px 10px',
      borderRadius:8, marginBottom:2, textDecoration:'none',
      background: active ? 'rgba(249,115,22,0.15)' : 'transparent',
      color: active ? '#F97316' : '#d1d5db',
      transition:'all 0.15s',
      justifyContent: mini ? 'center' : 'flex-start',
    }}
  >
    <i className={`ti ${icon}`} style={{fontSize:18, flexShrink:0, color: active ? '#F97316' : '#9ca3af'}}/>
    {!mini && <span style={{fontSize:13, fontWeight: active ? 600 : 400, whiteSpace:'nowrap'}}>{label}</span>}
    {active && !mini && <div style={{width:3, height:16, background:'#F97316', borderRadius:2, marginLeft:'auto'}}/>}
  </Link>
);

interface DividerProps { label: string; mini: boolean; }
const Divider: React.FC<DividerProps> = ({ label, mini }) => (
  <div style={{
    padding: mini ? '8px 0' : '8px 10px 4px',
    color:'rgba(255,255,255,0.35)', fontSize:10,
    textTransform:'uppercase', letterSpacing:1,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    marginTop:4
  }}>
    {!mini && label}
  </div>
);

export default AppSidebar;
