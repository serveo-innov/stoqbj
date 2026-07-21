export const all_routes = {

  // Auth
  login:           '/login',
  register:        '/inscription',
  forgotPassword:  '/forgot-password',
  setPassword:     '/set-password',
  error404:        '/error-404',
  error500:        '/error-500',

  // Dashboard
  dashboard:       '/dashboard',

  // POS & Ventes
  pos:             '/pos',
  salesList:       '/ventes',
  saleDetail:      '/ventes/:id',

  // Catalogue
  products:        '/catalogue/produits',
  productDetail:   '/catalogue/produits/:id',
  categories:      '/catalogue/categories',
  suppliers:       '/catalogue/fournisseurs',

  // Stock
  stockEntry:      '/stock/entree',
  stockMovements:  '/stock/mouvements',
  stockAlerts:     '/stock/alertes',
  inventory:       '/stock/inventaire',

  // Crédits
  credits:         '/credits',
  creditDetail:    '/credits/:id',
  debtors:         '/credits/debiteurs',

  // Rapports
  reports:         '/rapports',
  reportDaily:     '/rapports/quotidien',
  reportPeriod:    '/rapports/periode',
  reportStock:     '/rapports/stock',

  // Exports
  exports:         '/exports',

  // Alertes
  alerts:          '/alertes',
  priceSuggestions:'/alertes/suggestions-prix',

  // Utilisateurs
  users:           '/utilisateurs',
  userDetail:      '/utilisateurs/:id',
  myProfile:       '/mon-profil',
  changePassword:  '/changer-mot-de-passe',

  // Super Admin
  adminDashboard:  '/admin/dashboard',
  adminShops:      '/admin/boutiques',
  adminShopDetail: '/admin/boutiques/:id',
  adminStats:      '/admin/statistiques',

  // Paramètres
  settings:        '/parametres',
  subscription:    '/abonnement',
};
