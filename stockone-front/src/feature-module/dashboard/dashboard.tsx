import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';
import { useSelector } from 'react-redux';
import store from '../../core/redux/store';

type RootState = ReturnType<typeof store.getState>;

interface DashboardData {
  date: string;
  ca_today: number;
  ca_yesterday: number;
  evolution_pct: number | null;
  ca_gros: number;
  ca_detail: number;
  ca_extra: number;
  nb_transactions: number;
  encaissements: number;
  credits_accordes: number;
  credits_en_cours: {
    total_remaining: number;
    nb_debtors: number;
    nb_overdue: number;
    total_overdue: number;
  };
  top_products: {
    product_name: string;
    unit_label: string;
    total_qty: number;
    total_ca: number;
  }[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' F';

const Dashboard: React.FC = () => {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get<{ data: DashboardData }>('/reports/dashboard');
        setData(res.data);
      } catch (e: any) {
        setError(e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="d-flex align-items-center justify-content-center" style={{minHeight:400}}>
      <div>
        <div className="spinner-border mb-3" style={{color:'#F97316', width:40, height:40}} role="status"/>
        <p className="text-muted text-center fs-13">Chargement du tableau de bord...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="alert" style={{background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, color:'#dc2626'}}>
      <i className="ti ti-alert-circle me-2"/>
      {error}
      <button className="btn btn-sm ms-3" style={{background:'#dc2626',color:'#fff'}} onClick={() => window.location.reload()}>
        Réessayer
      </button>
    </div>
  );

  const evol = data?.evolution_pct;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h4 className="page-title">Tableau de bord</h4>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item active fs-13" style={{color:'#F97316'}}>
                {user?.shop?.commercial_name || user?.shop?.shop_name || 'Stock.one'}
              </li>
              <li className="breadcrumb-item fs-13 text-muted">
                {new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}
              </li>
            </ol>
          </nav>
        </div>
        <Link to={all_routes.pos} className="btn d-flex align-items-center gap-2"
          style={{background:'#F97316', color:'#fff', borderRadius:8, padding:'8px 16px', fontWeight:600}}>
          <i className="ti ti-shopping-cart fs-16"/>
          Ouvrir la caisse
        </Link>
      </div>

      {/* ── KPI Cards ── */}
      <div className="row g-3 mb-4">
        <div className="col-xl-3 col-md-6">
          <div className="kpi-card">
            <div className="d-flex align-items-start justify-content-between">
              <div>
                <p className="kpi-label mb-1">CA du jour</p>
                <h3 className="kpi-value">{fmt(data?.ca_today || 0)}</h3>
                {evol !== null && evol !== undefined && (
                  <span className={`kpi-trend ${evol >= 0 ? 'up' : 'down'}`}>
                    <i className={`ti ${evol >= 0 ? 'ti-trending-up' : 'ti-trending-down'} me-1`}/>
                    {Math.abs(evol)}% vs hier
                  </span>
                )}
              </div>
              <div className="kpi-icon">
                <i className="ti ti-currency-franc"/>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="kpi-card" style={{borderLeftColor:'#1a1a1a'}}>
            <div className="d-flex align-items-start justify-content-between">
              <div>
                <p className="kpi-label mb-1">Transactions</p>
                <h3 className="kpi-value">{data?.nb_transactions || 0}</h3>
                <span className="kpi-trend" style={{color:'#6b7280'}}>ventes aujourd'hui</span>
              </div>
              <div className="kpi-icon" style={{background:'#f3f4f6', color:'#1a1a1a'}}>
                <i className="ti ti-receipt"/>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
            <div className="d-flex align-items-start justify-content-between">
              <div>
                <p className="kpi-label mb-1">Encaissements</p>
                <h3 className="kpi-value">{fmt(data?.encaissements || 0)}</h3>
                <span className="kpi-trend up">
                  <i className="ti ti-cash me-1"/>
                  Cash reçu
                </span>
              </div>
              <div className="kpi-icon" style={{background:'#f0fdf4', color:'#16a34a'}}>
                <i className="ti ti-cash"/>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
            <div className="d-flex align-items-start justify-content-between">
              <div>
                <p className="kpi-label mb-1">Crédits accordés</p>
                <h3 className="kpi-value">{fmt(data?.credits_accordes || 0)}</h3>
                <span className="kpi-trend down">
                  <i className="ti ti-credit-card me-1"/>
                  Aujourd'hui
                </span>
              </div>
              <div className="kpi-icon" style={{background:'#fef2f2', color:'#dc2626'}}>
                <i className="ti ti-credit-card"/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Répartition CA + Crédits en cours ── */}
      <div className="row g-3 mb-4">

        {/* Répartition CA */}
        <div className="col-xl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-700 mb-0">Répartition du CA</h6>
                <span className="fs-12 text-muted">{data?.date}</span>
              </div>

              {/* Barres de progression */}
              {[
                { label:'Ventes Gros',   value: data?.ca_gros   || 0, color:'#1a1a1a', icon:'ti-building-warehouse' },
                { label:'Ventes Détail', value: data?.ca_detail || 0, color:'#F97316', icon:'ti-shopping-bag' },
                { label:'Ventes Extra',  value: data?.ca_extra  || 0, color:'#EA580C', icon:'ti-star' },
              ].map((item) => {
                const total = (data?.ca_today || 0);
                const pct   = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.label} className="mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{width:8, height:8, borderRadius:'50%', background:item.color}}/>
                        <span className="fs-13 fw-600">{item.label}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fs-13 fw-600">{fmt(item.value)}</span>
                        <span className="fs-12 text-muted">({pct}%)</span>
                      </div>
                    </div>
                    <div style={{height:8, background:'#f3f4f6', borderRadius:4, overflow:'hidden'}}>
                      <div style={{
                        height:'100%', width:`${pct}%`,
                        background:item.color, borderRadius:4,
                        transition:'width 0.8s ease'
                      }}/>
                    </div>
                  </div>
                );
              })}

              {/* Total */}
              <div className="d-flex align-items-center justify-content-between mt-3 pt-3"
                style={{borderTop:'1px solid #e5e7eb'}}>
                <span className="fw-700 fs-14">Total CA</span>
                <span className="fw-700 fs-16" style={{color:'#F97316'}}>{fmt(data?.ca_today || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Crédits en cours */}
        <div className="col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-700 mb-0">Crédits en cours</h6>
                <Link to={all_routes.credits} className="fs-12" style={{color:'#F97316'}}>
                  Voir tout <i className="ti ti-arrow-right"/>
                </Link>
              </div>

              <div className="mb-3 p-3 rounded-3" style={{background:'#fff7ed', border:'1px solid #FED7AA'}}>
                <p className="fs-12 text-muted mb-1">Total restant dû</p>
                <h4 className="fw-700 mb-0" style={{color:'#EA580C'}}>
                  {fmt(data?.credits_en_cours?.total_remaining || 0)}
                </h4>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="p-2 rounded-3 text-center" style={{background:'#f3f4f6'}}>
                    <div className="fw-700 fs-18">{data?.credits_en_cours?.nb_debtors || 0}</div>
                    <div className="fs-11 text-muted">Débiteurs</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-2 rounded-3 text-center" style={{background:'#fef2f2'}}>
                    <div className="fw-700 fs-18" style={{color:'#dc2626'}}>{data?.credits_en_cours?.nb_overdue || 0}</div>
                    <div className="fs-11 text-muted">En retard</div>
                  </div>
                </div>
              </div>

              {(data?.credits_en_cours?.nb_overdue || 0) > 0 && (
                <div className="mt-3 p-2 rounded-3 d-flex align-items-center gap-2"
                  style={{background:'#fef2f2', border:'1px solid #fca5a5'}}>
                  <i className="ti ti-alert-triangle" style={{color:'#dc2626'}}/>
                  <span className="fs-12" style={{color:'#dc2626'}}>
                    {fmt(data?.credits_en_cours?.total_overdue || 0)} en retard
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Produits ── */}
      {(data?.top_products?.length || 0) > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-700 mb-0">Top produits du jour</h6>
              <Link to={all_routes.products} className="fs-12" style={{color:'#F97316'}}>
                Voir catalogue <i className="ti ti-arrow-right"/>
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr style={{background:'#f8f9fa'}}>
                    <th className="fs-12 fw-600 border-0">#</th>
                    <th className="fs-12 fw-600 border-0">Produit</th>
                    <th className="fs-12 fw-600 border-0 text-center">Quantité</th>
                    <th className="fs-12 fw-600 border-0 text-end">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.top_products?.map((p, i) => (
                    <tr key={i}>
                      <td className="fs-13">
                        <span style={{
                          width:24, height:24, borderRadius:'50%',
                          background: i === 0 ? '#F97316' : i === 1 ? '#EA580C' : '#f3f4f6',
                          color: i < 2 ? '#fff' : '#6b7280',
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, fontWeight:700
                        }}>
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <div className="fs-13 fw-600">{p.product_name}</div>
                        <div className="fs-11 text-muted">{p.unit_label}</div>
                      </td>
                      <td className="text-center">
                        <span className="badge" style={{background:'#fff7ed',color:'#EA580C',border:'1px solid #FED7AA'}}>
                          {p.total_qty} unités
                        </span>
                      </td>
                      <td className="text-end fw-600 fs-13" style={{color:'#F97316'}}>
                        {fmt(p.total_ca)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Raccourcis rapides ── */}
      <div className="row g-3">
        {[
          { label:'Entrée stock',   icon:'ti-arrow-down-circle', to: all_routes.stockEntry,    color:'#1a1a1a' },
          { label:'Voir crédits',   icon:'ti-credit-card',       to: all_routes.credits,       color:'#dc2626' },
          { label:'Rapport du jour',icon:'ti-chart-bar',         to: all_routes.reportDaily,   color:'#0891b2' },
          { label:'Alertes',        icon:'ti-bell',              to: all_routes.stockAlerts,   color:'#F97316' },
        ].map((item) => (
          <div key={item.label} className="col-xl-3 col-md-6">
            <Link to={item.to} style={{textDecoration:'none'}}>
              <div className="card border-0 shadow-sm p-3 d-flex flex-row align-items-center gap-3"
                style={{borderRadius:10, transition:'all 0.2s', cursor:'pointer'}}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform='none'}
              >
                <div style={{
                  width:44, height:44, borderRadius:10,
                  background:`${item.color}15`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:item.color, fontSize:20, flexShrink:0
                }}>
                  <i className={`ti ${item.icon}`}/>
                </div>
                <span className="fs-14 fw-600" style={{color:'#1a1a1a'}}>{item.label}</span>
                <i className="ti ti-arrow-right ms-auto text-muted fs-14"/>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
