import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';

interface PlatformStats {
  shops: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    expiring_30days: number;
  };
  users: {
    total: number;
    admin_shop: number;
    gerant: number;
    caissier: number;
    active: number;
  };
  revenue: {
    subscriptions_total: number;
    subscriptions_year: number;
    subscriptions_month: number;
  };
  activity: {
    total_sales: number;
    sales_today: number;
    sales_this_month: number;
    top_shops: {
      shop_id: number;
      ca: number;
      nb: number;
      shop: { id: number; shop_name: string; commercial_name: string | null };
    }[];
  };
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';

const AdminStats: React.FC = () => {
  const [stats,   setStats]   = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: PlatformStats }>('/admin/stats');
      setStats(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="alert" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
        <i className="ti ti-alert-circle me-2"/>{error || 'Impossible de charger les statistiques.'}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Statistiques Plateforme</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Super Admin</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Statistiques</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2"
          onClick={load}
          style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>
          <i className="ti ti-refresh fs-16"/>Actualiser
        </button>
      </div>

      {/* Boutiques */}
      <h6 className="fw-700 mb-2 text-muted fs-13" style={{textTransform:'uppercase',letterSpacing:0.5}}>Boutiques</h6>
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Total</p>
            <h3 className="kpi-value">{stats.shops.total}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
            <p className="kpi-label mb-1">Actives</p>
            <h3 className="kpi-value" style={{color:'#16a34a'}}>{stats.shops.active}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card" style={{borderLeftColor:'#d97706'}}>
            <p className="kpi-label mb-1">En essai</p>
            <h3 className="kpi-value" style={{color:'#d97706'}}>{stats.shops.trial}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
            <p className="kpi-label mb-1">Suspendues</p>
            <h3 className="kpi-value" style={{color:'#dc2626'}}>{stats.shops.suspended}</h3>
          </div>
        </div>
      </div>
      {stats.shops.expiring_30days > 0 && (
        <div className="alert mb-4 d-flex align-items-center gap-2"
          style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,color:'#d97706'}}>
          <i className="ti ti-calendar-exclamation"/>
          {stats.shops.expiring_30days} boutique{stats.shops.expiring_30days > 1 ? 's' : ''} expire{stats.shops.expiring_30days > 1 ? 'nt' : ''} dans les 30 prochains jours
        </div>
      )}

      {/* Utilisateurs */}
      <h6 className="fw-700 mb-2 text-muted fs-13" style={{textTransform:'uppercase',letterSpacing:0.5}}>Utilisateurs</h6>
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card" style={{borderLeftColor:'#F97316'}}>
            <p className="kpi-label mb-1">Total</p>
            <h3 className="kpi-value" style={{color:'#F97316'}}>{stats.users.total}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Admin Boutique</p>
            <h3 className="kpi-value">{stats.users.admin_shop}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Gérants</p>
            <h3 className="kpi-value">{stats.users.gerant}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Caissiers</p>
            <h3 className="kpi-value">{stats.users.caissier}</h3>
          </div>
        </div>
      </div>

      {/* Revenus */}
      <h6 className="fw-700 mb-2 text-muted fs-13" style={{textTransform:'uppercase',letterSpacing:0.5}}>Revenus abonnements</h6>
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
            <p className="kpi-label mb-1">Total (tout temps)</p>
            <h3 className="kpi-value" style={{color:'#16a34a'}}>{fmt(stats.revenue.subscriptions_total)}</h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Cette année</p>
            <h3 className="kpi-value">{fmt(stats.revenue.subscriptions_year)}</h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Ce mois</p>
            <h3 className="kpi-value">{fmt(stats.revenue.subscriptions_month)}</h3>
          </div>
        </div>
      </div>

      {/* Activité */}
      <h6 className="fw-700 mb-2 text-muted fs-13" style={{textTransform:'uppercase',letterSpacing:0.5}}>Activité ventes (toutes boutiques)</h6>
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Total ventes</p>
            <h3 className="kpi-value">{stats.activity.total_sales}</h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card" style={{borderLeftColor:'#F97316'}}>
            <p className="kpi-label mb-1">Aujourd'hui</p>
            <h3 className="kpi-value" style={{color:'#F97316'}}>{stats.activity.sales_today}</h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card">
            <p className="kpi-label mb-1">Ce mois</p>
            <h3 className="kpi-value">{stats.activity.sales_this_month}</h3>
          </div>
        </div>
      </div>

      {/* Top boutiques */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
            <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
              <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>
              Top 5 boutiques du mois
            </h6>
          </div>
          {stats.activity.top_shops.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">Aucune donnée ce mois-ci</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">#</th>
                    <th className="fs-12 fw-600 border-0">Boutique</th>
                    <th className="fs-12 fw-600 border-0 text-center">Ventes</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.activity.top_shops.map((s, idx) => (
                    <tr key={s.shop_id}>
                      <td className="ps-3 align-middle">
                        <span style={{
                          width:28, height:28, borderRadius:'50%',
                          background: idx < 3 ? '#F97316' : '#f3f4f6',
                          color: idx < 3 ? '#fff' : '#6b7280',
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                          fontSize:12, fontWeight:700
                        }}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="align-middle fw-600 fs-13">
                        {s.shop?.commercial_name || s.shop?.shop_name || `Boutique #${s.shop_id}`}
                      </td>
                      <td className="align-middle text-center fs-13">{s.nb}</td>
                      <td className="align-middle text-end pe-3 fw-700 fs-13" style={{color:'#F97316'}}>{fmt(s.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
