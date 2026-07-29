import React, { lazy, Suspense, useEffect } from 'react';
import { all_routes } from './all_routes';
import RequireActiveShop from '../../core/components/RequireActiveShop';

// Lazy loading des pages
const Login          = lazy(() => import('../auth/login/login'));
const Register       = lazy(() => import('../auth/register/register'));
const ForgotPassword = lazy(() => import('../auth/forgotPassword/forgotPassword'));
const SetPassword    = lazy(() => import('../auth/setPassword/setPassword'));
const Dashboard      = lazy(() => import('../dashboard/dashboard'));
const Pos            = lazy(() => import('../pos/pos'));
const SalesList      = lazy(() => import('../pos/salesList'));
const Products       = lazy(() => import('../catalogue/products'));
const ProductDetail  = lazy(() => import('../catalogue/productDetail'));
const Categories     = lazy(() => import('../catalogue/categories'));
const Suppliers      = lazy(() => import('../catalogue/suppliers'));
const StockEntry     = lazy(() => import('../stock/stockEntry'));
const StockMovements = lazy(() => import('../stock/stockMovements'));
const StockAlerts    = lazy(() => import('../stock/stockAlerts'));
const Inventory      = lazy(() => import('../stock/inventory'));
const Credits        = lazy(() => import('../credits/credits'));
const CreditDetail   = lazy(() => import('../credits/creditDetail'));
const Debtors        = lazy(() => import('../credits/debtors'));
const Reports        = lazy(() => import('../reports/reports'));
const ReportDaily    = lazy(() => import('../reports/reportDaily'));
const ReportPeriod   = lazy(() => import('../reports/reportPeriod'));
const ReportStock    = lazy(() => import('../reports/reportStock'));
const Alerts         = lazy(() => import('../alerts/alerts'));
const Users          = lazy(() => import('../users/users'));
const MyProfile      = lazy(() => import('../users/myProfile'));
const AdminShops     = lazy(() => import('../admin/adminShops'));
const AdminStats     = lazy(() => import('../admin/adminStats'));
const Settings       = lazy(() => import('../settings/settings'));
const Subscription   = lazy(() => import('../settings/subscription'));
const Error404       = lazy(() => import('../auth/error/error404'));
const Error500       = lazy(() => import('../auth/error/error500'));

const Loading = () => (
  <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
    <div className="spinner-border text-warning" role="status">
      <span className="visually-hidden">Chargement...</span>
    </div>
  </div>
);

// Definit le titre de l'onglet pour la page active
const TitledPage: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  useEffect(() => {
    document.title = title ? `${title} — Stoq.bj` : 'Stoq.bj';
  }, [title]);
  return <>{children}</>;
};

const withSuspense = (Component: React.LazyExoticComponent<any>, title: string) => (
  <Suspense fallback={<Loading />}>
    <TitledPage title={title}><Component /></TitledPage>
  </Suspense>
);

// Pour les pages operationnelles propres a UNE boutique (Produits, Stock,
// Ventes, Credits...) : le Super Admin y a acces (cahier des charges), mais
// doit avoir choisi une boutique au prealable, sinon un message l'invite a
// en choisir une plutot que de laisser la page planter.
const withGuardedSuspense = (Component: React.LazyExoticComponent<any>, title: string) => (
  <Suspense fallback={<Loading />}>
    <TitledPage title={title}>
      <RequireActiveShop>
        <Component />
      </RequireActiveShop>
    </TitledPage>
  </Suspense>
);

// Routes publiques (auth)
export const authRoutes = [
  { path: all_routes.login,          element: withSuspense(Login, 'Connexion') },
  { path: all_routes.register,       element: withSuspense(Register, 'Creer un compte') },
  { path: all_routes.forgotPassword, element: withSuspense(ForgotPassword, 'Mot de passe oublie') },
  { path: all_routes.setPassword,    element: withSuspense(SetPassword, 'Nouveau mot de passe') },
  { path: all_routes.error404,       element: withSuspense(Error404, 'Page introuvable') },
  { path: all_routes.error500,       element: withSuspense(Error500, 'Erreur serveur') },
  { path: '*',                       element: withSuspense(Error404, 'Page introuvable') },
];

// Routes protégées (app)
export const publicRoutes = [
  // Dashboard
  { path: all_routes.dashboard,         element: withGuardedSuspense(Dashboard, 'Tableau de bord') },

  // POS
  { path: all_routes.pos,               element: withGuardedSuspense(Pos, 'Caisse') },
  { path: all_routes.salesList,         element: withGuardedSuspense(SalesList, 'Ventes') },

  // Catalogue
  { path: all_routes.products,          element: withGuardedSuspense(Products, 'Produits') },
  { path: all_routes.productDetail,     element: withGuardedSuspense(ProductDetail, 'Detail produit') },
  { path: all_routes.categories,        element: withGuardedSuspense(Categories, 'Categories') },
  { path: all_routes.suppliers,         element: withGuardedSuspense(Suppliers, 'Fournisseurs') },

  // Stock
  { path: all_routes.stockEntry,        element: withGuardedSuspense(StockEntry, 'Entree de stock') },
  { path: all_routes.stockMovements,    element: withGuardedSuspense(StockMovements, 'Mouvements de stock') },
  { path: all_routes.stockAlerts,       element: withGuardedSuspense(StockAlerts, 'Alertes stock') },
  { path: all_routes.inventory,         element: withGuardedSuspense(Inventory, 'Inventaire') },

  // Crédits
  { path: all_routes.credits,           element: withGuardedSuspense(Credits, 'Credits') },
  { path: all_routes.creditDetail,      element: withGuardedSuspense(CreditDetail, 'Detail credit') },
  { path: all_routes.debtors,           element: withGuardedSuspense(Debtors, 'Debiteurs') },

  // Rapports
  { path: all_routes.reports,           element: withGuardedSuspense(Reports, 'Rapports') },
  { path: all_routes.reportDaily,       element: withGuardedSuspense(ReportDaily, 'Rapport quotidien') },
  { path: all_routes.reportPeriod,      element: withGuardedSuspense(ReportPeriod, 'Rapport periodique') },
  { path: all_routes.reportStock,       element: withGuardedSuspense(ReportStock, 'Rapport de stock') },

  // Alertes
  { path: all_routes.alerts,            element: withGuardedSuspense(Alerts, 'Alertes') },

  // Utilisateurs
  { path: all_routes.users,             element: withGuardedSuspense(Users, 'Utilisateurs') },
  { path: all_routes.myProfile,         element: withSuspense(MyProfile, 'Mon profil') },

  // Super Admin
  { path: all_routes.adminShops,        element: withSuspense(AdminShops, 'Boutiques') },
  { path: all_routes.adminStats,        element: withSuspense(AdminStats, 'Statistiques') },
  { path: all_routes.adminDashboard,    element: withSuspense(AdminStats, 'Tableau de bord admin') },

  // Paramètres
  { path: all_routes.settings,          element: withSuspense(Settings, 'Parametres') },
  { path: all_routes.subscription,      element: withSuspense(Subscription, 'Abonnement') },
];