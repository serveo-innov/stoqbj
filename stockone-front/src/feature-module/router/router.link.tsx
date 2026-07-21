import React, { lazy, Suspense } from 'react';
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

const withSuspense = (Component: React.LazyExoticComponent<any>) => (
  <Suspense fallback={<Loading />}>
    <Component />
  </Suspense>
);

// Pour les pages operationnelles propres a UNE boutique (Produits, Stock,
// Ventes, Credits...) : le Super Admin y a acces (cahier des charges), mais
// doit avoir choisi une boutique au prealable, sinon un message l'invite a
// en choisir une plutot que de laisser la page planter.
const withGuardedSuspense = (Component: React.LazyExoticComponent<any>) => (
  <Suspense fallback={<Loading />}>
    <RequireActiveShop>
      <Component />
    </RequireActiveShop>
  </Suspense>
);

// Routes publiques (auth)
export const authRoutes = [
  { path: all_routes.login,         element: withSuspense(Login) },
  { path: all_routes.register,      element: withSuspense(Register) },
  { path: all_routes.forgotPassword, element: withSuspense(ForgotPassword) },
  { path: all_routes.setPassword,    element: withSuspense(SetPassword) },
  { path: all_routes.error404,      element: withSuspense(Error404) },
  { path: all_routes.error500,      element: withSuspense(Error500) },
  { path: '*',                      element: withSuspense(Error404) },
];

// Routes protégées (app)
export const publicRoutes = [
  // Dashboard
  { path: all_routes.dashboard,         element: withGuardedSuspense(Dashboard) },

  // POS
  { path: all_routes.pos,               element: withGuardedSuspense(Pos) },
  { path: all_routes.salesList,         element: withGuardedSuspense(SalesList) },

  // Catalogue
  { path: all_routes.products,          element: withGuardedSuspense(Products) },
  { path: all_routes.productDetail,     element: withGuardedSuspense(ProductDetail) },
  { path: all_routes.categories,        element: withGuardedSuspense(Categories) },
  { path: all_routes.suppliers,         element: withGuardedSuspense(Suppliers) },

  // Stock
  { path: all_routes.stockEntry,        element: withGuardedSuspense(StockEntry) },
  { path: all_routes.stockMovements,    element: withGuardedSuspense(StockMovements) },
  { path: all_routes.stockAlerts,       element: withGuardedSuspense(StockAlerts) },
  { path: all_routes.inventory,         element: withGuardedSuspense(Inventory) },

  // Crédits
  { path: all_routes.credits,           element: withGuardedSuspense(Credits) },
  { path: all_routes.creditDetail,      element: withGuardedSuspense(CreditDetail) },
  { path: all_routes.debtors,           element: withGuardedSuspense(Debtors) },

  // Rapports
  { path: all_routes.reports,           element: withGuardedSuspense(Reports) },
  { path: all_routes.reportDaily,       element: withGuardedSuspense(ReportDaily) },
  { path: all_routes.reportPeriod,      element: withGuardedSuspense(ReportPeriod) },
  { path: all_routes.reportStock,       element: withGuardedSuspense(ReportStock) },

  // Alertes
  { path: all_routes.alerts,            element: withGuardedSuspense(Alerts) },

  // Utilisateurs
  { path: all_routes.users,             element: withGuardedSuspense(Users) },
  { path: all_routes.myProfile,         element: withSuspense(MyProfile) },

  // Super Admin
  { path: all_routes.adminShops,        element: withSuspense(AdminShops) },
  { path: all_routes.adminStats,        element: withSuspense(AdminStats) },
  { path: all_routes.adminDashboard,    element: withSuspense(AdminStats) },

  // Paramètres
  { path: all_routes.settings,          element: withSuspense(Settings) },
  { path: all_routes.subscription,      element: withSuspense(Subscription) },
];
