import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';
import { API_BASE_URL } from '../../environment';

interface TopProduct { name: string; qty: number; ca: number; }
interface StockAlertItem { name: string; stock: number; }

interface DailyReportData {
  id: number;
  report_date: string;
  ca_gros: string;
  ca_detail: string;
  ca_extra: string;
  ca_total: string;
  encaissements: string;
  credits_accordes: string;
  credits_percus: string;
  nb_transactions: number;
  nb_new_credits: number;
  top_products: TopProduct[];
  stock_alerts: StockAlertItem[];
  generated_at: string;
}

interface HistoryRow {
  id: number;
  report_date: string;
  ca_total: string;
  nb_transactions: number;
  encaissements: string;
}

const fmt = (n: string | number) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' F';
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
const fmtDateShort = (d: string) => new Date(d).toLocaleDateString('fr-FR');

const getToken = (): string | null => localStorage.getItem('stockone_token');
const getShopId = (): number | null => {
  const user = JSON.parse(localStorage.getItem('stockone_user') || 'null');
  return user?.role === 'super_admin' ? null : user?.shop?.id ?? null;
};

const ReportDaily: React.FC = () => {
  const [date,    setDate]    = useState(todayStr());
  const [report,  setReport]  = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [history,       setHistory]       = useState<HistoryRow[]>([]);
  const [loadingHistory,setLoadingHistory]= useState(true);

  useEffect(() => { load(); }, [date]);
  useEffect(() => { loadHistory(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ data: DailyReportData }>('/reports/daily', { date });
      setReport(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get<{ data: HistoryRow[] }>('/reports/daily/history', { months: 3 });
      setHistory(res.data);
    } catch { /* non bloquant */ }
    finally { setLoadingHistory(false); }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE_URL}/invoices/report/daily`);
      url.searchParams.set('date', date);
      const shopId = getShopId();
      if (shopId) url.searchParams.set('shop_id', String(shopId));
      const token = getToken();

      const response = await fetch(url.toString(), {
        headers: { 'Accept':'application/pdf', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || `Erreur ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition && disposition.match(/filename="?(.+)"?/);
      const filename = match ? match[1].replace(/"/g,'') : `rapport-${date}.pdf`;

      const link = document.createElement('a');
      const objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      setError(e.message || "Erreur lors du téléchargement du PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Rapport Quotidien</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Rapports</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Quotidien</li>
          </ol>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <input type="date" className="form-control form-control-sm" value={date}
            max={todayStr()}
            onChange={e => setDate(e.target.value)}
            style={{borderColor:'#e5e7eb',borderRadius:8}}/>
          <button className="btn btn-sm d-flex align-items-center gap-1" disabled={downloading} onClick={handleDownloadPdf}
            style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontWeight:600}}>
            {downloading ? <span className="spinner-border spinner-border-sm"/> : <><i className="ti ti-download"/>PDF</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
          <button className="btn-close ms-auto" onClick={() => setError(null)}/>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
      ) : report && (
        <>
          <p className="fs-13 text-muted mb-3" style={{textTransform:'capitalize'}}>{fmtDate(report.report_date)}</p>

          {/* KPIs */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#F97316'}}>
                <p className="kpi-label mb-1">CA Total</p>
                <h3 className="kpi-value" style={{color:'#F97316'}}>{fmt(report.ca_total)}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
                <p className="kpi-label mb-1">Encaissements</p>
                <h3 className="kpi-value" style={{color:'#16a34a'}}>{fmt(report.encaissements)}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
                <p className="kpi-label mb-1">Crédits accordés</p>
                <h3 className="kpi-value" style={{color:'#dc2626'}}>{fmt(report.credits_accordes)}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card">
                <p className="kpi-label mb-1">Transactions</p>
                <h3 className="kpi-value">{report.nb_transactions}</h3>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm"><div className="card-body">
                <p className="fs-12 text-muted mb-1">CA Gros</p><h5 className="fw-700 mb-0">{fmt(report.ca_gros)}</h5>
              </div></div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm"><div className="card-body">
                <p className="fs-12 text-muted mb-1">CA Détail</p><h5 className="fw-700 mb-0">{fmt(report.ca_detail)}</h5>
              </div></div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm"><div className="card-body">
                <p className="fs-12 text-muted mb-1">CA Extra</p><h5 className="fw-700 mb-0">{fmt(report.ca_extra)}</h5>
              </div></div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            {/* Top produits */}
            <div className="col-xl-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-0">
                  <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                    <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                      <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>Top produits du jour
                    </h6>
                  </div>
                  {report.top_products.length === 0 ? (
                    <div className="text-center py-4"><p className="text-muted fs-13">Aucune vente</p></div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <tbody>
                          {report.top_products.map((p, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 fs-13">{p.name}</td>
                              <td className="text-center fs-13 text-muted">{p.qty} u.</td>
                              <td className="text-end pe-3 fw-600 fs-13" style={{color:'#F97316'}}>{fmt(p.ca)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alertes stock */}
            <div className="col-xl-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-0">
                  <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                    <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                      <div style={{width:4,height:20,background:'#dc2626',borderRadius:2}}/>Alertes stock du jour
                    </h6>
                  </div>
                  {report.stock_alerts.length === 0 ? (
                    <div className="text-center py-4"><p className="text-muted fs-13">Aucune alerte</p></div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <tbody>
                          {report.stock_alerts.map((a, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 fs-13">{a.name}</td>
                              <td className="text-end pe-3 fw-600 fs-13" style={{color: a.stock <= 0 ? '#dc2626' : '#EA580C'}}>
                                {a.stock} en stock
                              </td>
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

      {/* Historique */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
            <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
              <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>Historique (3 derniers mois)
            </h6>
          </div>
          {loadingHistory ? (
            <div className="text-center py-4"><div className="spinner-border spinner-border-sm" style={{color:'#F97316'}} role="status"/></div>
          ) : history.length === 0 ? (
            <div className="text-center py-4"><p className="text-muted fs-13">Aucun historique disponible</p></div>
          ) : (
            <div className="table-responsive" style={{maxHeight:300, overflowY:'auto'}}>
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa', position:'sticky', top:0}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Date</th>
                    <th className="fs-12 fw-600 border-0 text-center">Transactions</th>
                    <th className="fs-12 fw-600 border-0 text-end">CA</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Encaissé</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{cursor:'pointer'}} onClick={() => setDate(h.report_date.slice(0,10))}>
                      <td className="ps-3 align-middle fs-13">{fmtDateShort(h.report_date)}</td>
                      <td className="align-middle text-center fs-13">{h.nb_transactions}</td>
                      <td className="align-middle text-end fw-600 fs-13">{fmt(h.ca_total)}</td>
                      <td className="align-middle text-end pe-3 fs-13" style={{color:'#16a34a'}}>{fmt(h.encaissements)}</td>
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

export default ReportDaily;
