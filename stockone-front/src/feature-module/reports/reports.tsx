import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';

interface DashboardData {
  date: string;
  ca_today: number;
  ca_yesterday: number;
  evolution_pct: number | null;
  nb_transactions: number;
  encaissements: number;
  credits_accordes: number;
  credits_en_cours: {
    total_remaining: number;
    nb_debtors: number;
    nb_overdue: number;
    total_overdue: number;
  };
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';

const Reports: React.FC = () => {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: DashboardData }>('/reports/dashboard');
      setData(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const cards = [
    { to: all_routes.reportDaily,  icon:'ti-calendar-event', label:'Rapport Quotidien', desc:"Ventes, encaissements et alertes du jour", color:'#F97316' },
    { to: all_routes.reportPeriod, icon:'ti-chart-bar',      label:'Rapport Période',    desc:'Analyse sur une plage de dates avec export', color:'#0891b2' },
    { to: all_routes.reportStock,  icon:'ti-packages',       label:'Rapport Stock',      desc:'Valeur du stock et répartition par catégorie', color:'#7c3aed' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Rapports</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Rapports</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Vue d'ensemble</li>
          </ol>
        </div>
      </div>

      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
        </div>
      )}

      {/* Aperçu du jour */}
      {loading ? (
        <div className="text-center py-4"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
      ) : data && (
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#F97316'}}>
              <p className="kpi-label mb-1">CA aujourd'hui</p>
              <h3 className="kpi-value" style={{color:'#F97316'}}>{fmt(data.ca_today)}</h3>
              {data.evolution_pct !== null && (
                <div className="fs-11 mt-1" style={{color: data.evolution_pct >= 0 ? '#16a34a' : '#dc2626'}}>
                  <i className={`ti ${data.evolution_pct >= 0 ? 'ti-trending-up' : 'ti-trending-down'} me-1`}/>
                  {data.evolution_pct}% vs hier
                </div>
              )}
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
              <p className="kpi-label mb-1">Encaissements</p>
              <h3 className="kpi-value" style={{color:'#16a34a'}}>{fmt(data.encaissements)}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
              <p className="kpi-label mb-1">Crédits en cours</p>
              <h3 className="kpi-value" style={{color:'#dc2626'}}>{fmt(data.credits_en_cours.total_remaining)}</h3>
              {data.credits_en_cours.nb_overdue > 0 && (
                <div className="fs-11 mt-1" style={{color:'#dc2626'}}>{data.credits_en_cours.nb_overdue} en retard</div>
              )}
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card">
              <p className="kpi-label mb-1">Transactions</p>
              <h3 className="kpi-value">{data.nb_transactions}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Navigation vers sous-rapports */}
      <div className="row g-3">
        {cards.map(c => (
          <div className="col-md-4" key={c.to}>
            <Link to={c.to} className="text-decoration-none">
              <div className="card border-0 shadow-sm h-100" style={{transition:'transform 0.15s'}}>
                <div className="card-body p-4">
                  <div style={{
                    width:48, height:48, borderRadius:12, background:`${c.color}15`,
                    display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16
                  }}>
                    <i className={`ti ${c.icon}`} style={{fontSize:24,color:c.color}}/>
                  </div>
                  <h6 className="fw-700 mb-1" style={{color:'#1a1a1a'}}>{c.label}</h6>
                  <p className="fs-13 text-muted mb-0">{c.desc}</p>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reports;
