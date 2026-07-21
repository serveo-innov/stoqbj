import React, { useState } from 'react';
import api from '../../core/services/apiService';
import { API_BASE_URL } from '../../environment';

interface Totals {
  ca_total: number;
  ca_gros: number;
  ca_detail: number;
  ca_extra: number;
  encaissements: number;
  credits_accordes: number;
  nb_transactions: number;
}

interface TimelineRow {
  period: string;
  nb_transactions: number;
  ca_total: number;
  encaissements: number;
  credits_accordes: number;
}

interface TopProduct {
  product_name: string;
  unit_label: string;
  total_qty: number;
  total_ca: number;
}

interface PeriodReport {
  from: string;
  to: string;
  totals: Totals;
  timeline: TimelineRow[];
  top_products: TopProduct[];
}

type GroupBy = 'day' | 'week' | 'month';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const getToken = (): string | null => localStorage.getItem('stockone_token');
const getShopId = (): number | null => {
  const user = JSON.parse(localStorage.getItem('stockone_user') || 'null');
  return user?.role === 'super_admin' ? null : user?.shop?.id ?? null;
};

const ReportPeriod: React.FC = () => {
  const [from,   setFrom]   = useState(monthAgoStr());
  const [to,     setTo]     = useState(todayStr());
  const [group,  setGroup]  = useState<GroupBy>('day');
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = async () => {
    if (!from || !to) { setError('Veuillez choisir les deux dates.'); return; }
    if (from > to)     { setError('La date de début doit précéder la date de fin.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: PeriodReport }>('/reports/period', { from, to, group });
      setReport(res.data);
    } catch (e: any) {
      setError(e.message || 'Erreur lors du chargement du rapport.');
    } finally {
      setLoading(false);
    }
  };

  // Export CSV : ces endpoints renvoient un fichier, pas du JSON -> fetch direct en blob
  const handleExport = async (endpoint: string, filenameFallback: string) => {
    if (!from || !to) { setError('Choisissez une période avant d\'exporter.'); return; }
    setExporting(endpoint);
    setError(null);
    try {
      const url = new URL(`${API_BASE_URL}${endpoint}`);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      const shopId = getShopId();
      if (shopId) url.searchParams.set('shop_id', String(shopId));

      const token = getToken();
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'text/csv',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || `Erreur ${response.status}`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition && disposition.match(/filename="?(.+)"?/);
      const filename = match ? match[1].replace(/"/g, '') : filenameFallback;

      const link = document.createElement('a');
      const objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\'export.');
    } finally {
      setExporting(null);
    }
  };

  const groupLabel = (p: string) => {
    if (group === 'day') {
      const d = new Date(p);
      return isNaN(d.getTime()) ? p : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return p;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Rapport Période</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Rapports</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Période</li>
          </ol>
        </div>
      </div>

      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
          <button className="btn-close ms-auto" onClick={() => setError(null)}/>
        </div>
      )}

      {/* Filtres */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Du</label>
              <input type="date" className="form-control form-select-sm"
                value={from} onChange={e => setFrom(e.target.value)}
                style={{borderColor:'#e5e7eb',borderRadius:8}}/>
            </div>
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Au</label>
              <input type="date" className="form-control form-select-sm"
                value={to} onChange={e => setTo(e.target.value)}
                style={{borderColor:'#e5e7eb',borderRadius:8}}/>
            </div>
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Grouper par</label>
              <select className="form-select form-select-sm"
                value={group} onChange={e => setGroup(e.target.value as GroupBy)}
                style={{borderColor:'#e5e7eb',borderRadius:8}}>
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </select>
            </div>
            <div className="col-md-3">
              <button className="btn w-100" onClick={load} disabled={loading}
                style={{background:'#F97316',color:'#fff',borderRadius:8,border:'none',fontWeight:600,padding:'8px'}}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"/>Chargement...</> : <><i className="ti ti-chart-bar me-2"/>Générer</>}
              </button>
            </div>
          </div>

          {/* Exports */}
          <div className="d-flex gap-2 flex-wrap mt-3 pt-3" style={{borderTop:'1px solid #f3f4f6'}}>
            <span className="fs-12 fw-600 text-muted align-self-center me-1">Exporter (CSV) :</span>
            {[
              { key:'/exports/sales',           label:'Ventes',           fallback:'ventes.csv' },
              { key:'/exports/sales/details',   label:'Détail ventes',    fallback:'detail_ventes.csv' },
              { key:'/exports/credits',         label:'Crédits',          fallback:'credits.csv' },
              { key:'/exports/stock/movements', label:'Mvts stock',       fallback:'mouvements_stock.csv' },
            ].map(exp => (
              <button key={exp.key} className="btn btn-sm"
                disabled={exporting === exp.key}
                onClick={() => handleExport(exp.key, exp.fallback)}
                style={{background:'#f3f4f6',border:'none',borderRadius:8,fontSize:12,fontWeight:600,padding:'6px 12px'}}>
                {exporting === exp.key
                  ? <span className="spinner-border spinner-border-sm"/>
                  : <><i className="ti ti-download me-1"/>{exp.label}</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!report && !loading && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <i className="ti ti-chart-bar d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
            <p className="text-muted">Choisissez une période et cliquez sur "Générer" pour voir le rapport.</p>
          </div>
        </div>
      )}

      {report && (
        <>
          {/* KPIs */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#F97316'}}>
                <p className="kpi-label mb-1">CA Total</p>
                <h3 className="kpi-value" style={{color:'#F97316'}}>{fmt(report.totals.ca_total)}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
                <p className="kpi-label mb-1">Encaissements</p>
                <h3 className="kpi-value" style={{color:'#16a34a'}}>{fmt(report.totals.encaissements)}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
                <p className="kpi-label mb-1">Crédits accordés</p>
                <h3 className="kpi-value" style={{color:'#dc2626'}}>{fmt(report.totals.credits_accordes)}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card">
                <p className="kpi-label mb-1">Transactions</p>
                <h3 className="kpi-value">{report.totals.nb_transactions}</h3>
              </div>
            </div>
          </div>

          {/* Répartition par type de vente */}
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <p className="fs-12 text-muted mb-1">CA Gros</p>
                  <h5 className="fw-700 mb-0">{fmt(report.totals.ca_gros)}</h5>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <p className="fs-12 text-muted mb-1">CA Détail</p>
                  <h5 className="fw-700 mb-0">{fmt(report.totals.ca_detail)}</h5>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <p className="fs-12 text-muted mb-1">CA Extra</p>
                  <h5 className="fw-700 mb-0">{fmt(report.totals.ca_extra)}</h5>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            {/* Timeline */}
            <div className="col-xl-7">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                  <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                    <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                      <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>
                      Évolution ({group === 'day' ? 'jour par jour' : group === 'week' ? 'semaine par semaine' : 'mois par mois'})
                    </h6>
                  </div>
                  {report.timeline.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">Aucune vente sur cette période</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead style={{background:'#f8f9fa'}}>
                          <tr>
                            <th className="fs-12 fw-600 border-0 ps-3">Période</th>
                            <th className="fs-12 fw-600 border-0 text-center">Trans.</th>
                            <th className="fs-12 fw-600 border-0 text-end">CA</th>
                            <th className="fs-12 fw-600 border-0 text-end pe-3">Encaissé</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.timeline.map((row, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 align-middle fs-13">{groupLabel(row.period)}</td>
                              <td className="align-middle text-center fs-13">{row.nb_transactions}</td>
                              <td className="align-middle text-end fw-600 fs-13">{fmt(row.ca_total)}</td>
                              <td className="align-middle text-end pe-3 fs-13" style={{color:'#16a34a'}}>{fmt(row.encaissements)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top produits */}
            <div className="col-xl-5">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                  <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                    <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                      <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>
                      Top produits
                    </h6>
                  </div>
                  {report.top_products.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">Aucune donnée</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead style={{background:'#f8f9fa'}}>
                          <tr>
                            <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                            <th className="fs-12 fw-600 border-0 text-center">Qté</th>
                            <th className="fs-12 fw-600 border-0 text-end pe-3">CA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.top_products.map((p, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 align-middle">
                                <div className="fw-600 fs-13">{p.product_name}</div>
                                <div className="fs-11 text-muted">{p.unit_label}</div>
                              </td>
                              <td className="align-middle text-center fs-13">{p.total_qty}</td>
                              <td className="align-middle text-end pe-3 fw-600 fs-13" style={{color:'#F97316'}}>{fmt(p.total_ca)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportPeriod;
