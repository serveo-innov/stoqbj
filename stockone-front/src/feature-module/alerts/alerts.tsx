import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';

interface AlertItem {
  id: number;
  type: string;
  is_read: boolean;
  is_resolved: boolean;
  meta: Record<string, any> | null;
  triggered_at: string;
  product_unit: { label: string; product: { id: number; name: string } } | null;
}

interface AlertCounts {
  total_unread: number;
  stock_alerts: number;
  credit_alerts: number;
  dormant_alerts: number;
  sub_alerts: number;
}

interface PriceSuggestion {
  id: number;
  current_price_wholesale: string;
  suggested_price_wholesale: string;
  current_price_extra: string;
  suggested_price_extra: string;
  dormant_days: number;
  estimated_margin: string;
  status: string;
  product_unit: { label: string; product: { name: string } };
}

const typeConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  stock_out:           { label:'Rupture de stock',      color:'#dc2626', bg:'#fef2f2', icon:'ti-package-off' },
  stock_low:           { label:'Stock bas',              color:'#EA580C', bg:'#fff7ed', icon:'ti-alert-triangle' },
  stock_critical:      { label:'Stock critique',         color:'#dc2626', bg:'#fef2f2', icon:'ti-alert-octagon' },
  credit_overdue:      { label:'Crédit en retard',       color:'#7c3aed', bg:'#f5f3ff', icon:'ti-credit-card-off' },
  subscription_expiry: { label:'Abonnement expirant',    color:'#d97706', bg:'#fffbeb', icon:'ti-calendar-exclamation' },
  margin_negative:     { label:'Marge négative',         color:'#dc2626', bg:'#fef2f2', icon:'ti-trending-down' },
};

const getTypeConfig = (type: string) => {
  if (typeConfig[type]) return typeConfig[type];
  if (type.startsWith('dormant_')) {
    return { label:'Produit dormant', color:'#0891b2', bg:'#ecfeff', icon:'ti-moon' };
  }
  return { label: type, color:'#6b7280', bg:'#f3f4f6', icon:'ti-bell' };
};

const fmt = (n: string | number) => new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
const fmtPct = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${n}%`;

const Alerts: React.FC = () => {
  const [tab, setTab] = useState<'alerts' | 'suggestions'>('alerts');

  // Alertes
  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [counts,     setCounts]     = useState<AlertCounts | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState<PriceSuggestion[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(true);
  const [acting,       setActing]     = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PriceSuggestion | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadAlerts(); }, [unreadOnly, typeFilter]);
  useEffect(() => { loadSuggestions(); }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (unreadOnly) params.unread_only = true;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get<{ counts: AlertCounts; data: any }>('/alerts', params);
      setCounts(res.counts);
      setAlerts(res.data?.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadSuggestions = async () => {
    try {
      setLoadingSugg(true);
      const res = await api.get<{ data: PriceSuggestion[] }>('/alerts/price-suggestions');
      setSuggestions(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingSugg(false); }
  };

  const markRead = async (id: number) => {
    try {
      await api.post(`/alerts/${id}/read`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
      if (counts) setCounts({ ...counts, total_unread: Math.max(0, counts.total_unread - 1) });
    } catch (e: any) { setError(e.message); }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/alerts/read-all');
      loadAlerts();
    } catch (e: any) { setError(e.message); }
    finally { setMarkingAll(false); }
  };

  const acceptSuggestion = async (s: PriceSuggestion) => {
    setActing(s.id);
    setError(null);
    try {
      await api.post(`/alerts/price-suggestions/${s.id}/accept`);
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
    } catch (e: any) { setError(e.message); }
    finally { setActing(null); }
  };

  const openReject = (s: PriceSuggestion) => { setRejectTarget(s); setRejectReason(''); };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setActing(rejectTarget.id);
    setError(null);
    try {
      await api.post(`/alerts/price-suggestions/${rejectTarget.id}/reject`, { reason: rejectReason || undefined });
      setSuggestions(prev => prev.filter(x => x.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (e: any) { setError(e.message); }
    finally { setActing(null); }
  };

  const renderMeta = (meta: Record<string, any> | null) => {
    if (!meta || Object.keys(meta).length === 0) return null;
    return (
      <div className="fs-11 text-muted mt-1">
        {Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(' · ')}
      </div>
    );
  };

  const renderMarginAlert = (a: AlertItem) => {
    const meta = a.meta || {};
    const productId = a.product_unit?.product?.id;
    return (
      <div className="mt-1">
        <div className="d-flex gap-3 fs-12">
          <span>Gros: <strong style={{color: (meta.wholesale_percent ?? 0) < 0 ? '#dc2626' : 'inherit'}}>{fmtPct(meta.wholesale_percent)}</strong></span>
          <span>Détail: <strong style={{color: (meta.detail_percent ?? 0) < 0 ? '#dc2626' : 'inherit'}}>{fmtPct(meta.detail_percent)}</strong></span>
          <span>Extra: <strong style={{color: (meta.extra_percent ?? 0) < 0 ? '#dc2626' : 'inherit'}}>{fmtPct(meta.extra_percent)}</strong></span>
        </div>
        {productId && (
          <Link to={all_routes.productDetail.replace(':id', String(productId))}
            className="btn btn-sm mt-2 d-inline-flex align-items-center gap-1"
            style={{background:'#F97316',color:'#fff',border:'none',borderRadius:6,fontSize:11,padding:'4px 10px'}}>
            <i className="ti ti-edit"/>Modifier le prix
          </Link>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Alertes IA</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Rapports</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Alertes IA</li>
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

      {counts && (
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#F97316'}}>
              <p className="kpi-label mb-1">Non lues</p>
              <h3 className="kpi-value" style={{color:'#F97316'}}>{counts.total_unread}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
              <p className="kpi-label mb-1">Alertes stock</p>
              <h3 className="kpi-value" style={{color:'#dc2626'}}>{counts.stock_alerts}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#7c3aed'}}>
              <p className="kpi-label mb-1">Crédits en retard</p>
              <h3 className="kpi-value" style={{color:'#7c3aed'}}>{counts.credit_alerts}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#0891b2'}}>
              <p className="kpi-label mb-1">Produits dormants</p>
              <h3 className="kpi-value" style={{color:'#0891b2'}}>{counts.dormant_alerts}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm"
          onClick={() => setTab('alerts')}
          style={{
            background: tab === 'alerts' ? '#F97316' : '#f3f4f6',
            color:      tab === 'alerts' ? '#fff'    : '#374151',
            border:'none', borderRadius:20, padding:'6px 16px', fontWeight:600, fontSize:12
          }}>
          <i className="ti ti-bell me-1"/>Alertes
        </button>
        <button className="btn btn-sm"
          onClick={() => setTab('suggestions')}
          style={{
            background: tab === 'suggestions' ? '#F97316' : '#f3f4f6',
            color:      tab === 'suggestions' ? '#fff'    : '#374151',
            border:'none', borderRadius:20, padding:'6px 16px', fontWeight:600, fontSize:12
          }}>
          <i className="ti ti-sparkles me-1"/>Suggestions de prix IA
          {suggestions.length > 0 && (
            <span className="badge ms-2" style={{background:'rgba(255,255,255,0.3)',fontSize:10}}>{suggestions.length}</span>
          )}
        </button>
      </div>

      {tab === 'alerts' ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="p-3 border-bottom d-flex gap-2 flex-wrap align-items-center" style={{borderColor:'#e5e7eb'}}>
              <select className="form-select form-select-sm" style={{width:'auto',borderColor:'#e5e7eb',borderRadius:8}}
                value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">Tous les types</option>
                <option value="stock_out">Rupture de stock</option>
                <option value="stock_low">Stock bas</option>
                <option value="stock_critical">Stock critique</option>
                <option value="credit_overdue">Crédit en retard</option>
                <option value="subscription_expiry">Abonnement expirant</option>
                <option value="margin_negative">Marge négative</option>
              </select>
              <div className="form-check form-switch ms-2">
                <input className="form-check-input" type="checkbox" id="unreadOnly"
                  checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}/>
                <label className="form-check-label fs-13" htmlFor="unreadOnly">Non lues uniquement</label>
              </div>
              <button className="btn btn-sm ms-auto" disabled={markingAll || !counts?.total_unread}
                onClick={markAllRead}
                style={{background:'#f3f4f6',border:'none',borderRadius:8,fontSize:12,fontWeight:600}}>
                {markingAll ? <span className="spinner-border spinner-border-sm"/> : <><i className="ti ti-checks me-1"/>Tout marquer comme lu</>}
              </button>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-5">
                <i className="ti ti-circle-check d-block mb-2" style={{fontSize:48,color:'#16a34a'}}/>
                <p className="text-muted">Aucune alerte pour le moment</p>
              </div>
            ) : (
              <div>
                {alerts.map(a => {
                  const cfg = getTypeConfig(a.type);
                  return (
                    <div key={a.id} className="d-flex align-items-start gap-3 p-3 border-bottom"
                      style={{borderColor:'#f3f4f6', background: a.is_read ? '#fff' : '#fffbf7'}}>
                      <div style={{
                        width:36,height:36,borderRadius:8,background:cfg.bg,color:cfg.color,
                        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0
                      }}>
                        <i className={`ti ${cfg.icon}`}/>
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-600 fs-13" style={{color:cfg.color}}>{cfg.label}</span>
                          {!a.is_read && <span style={{width:6,height:6,borderRadius:'50%',background:'#F97316'}}/>}
                        </div>
                        {a.product_unit && (
                          <div className="fs-13 mt-1">
                            {a.product_unit.product.name} — {a.product_unit.label}
                          </div>
                        )}
                        {a.type === 'margin_negative' ? renderMarginAlert(a) : renderMeta(a.meta)}
                        <div className="fs-11 text-muted mt-1">{fmtDate(a.triggered_at)}</div>
                      </div>
                      {!a.is_read && (
                        <button className="btn btn-sm"
                          onClick={() => markRead(a.id)}
                          style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:11,padding:'4px 10px'}}>
                          <i className="ti ti-check"/>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loadingSugg ? (
              <div className="text-center py-5">
                <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-5">
                <i className="ti ti-sparkles d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
                <p className="text-muted">Aucune suggestion de prix en attente</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead style={{background:'#f8f9fa'}}>
                    <tr>
                      <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                      <th className="fs-12 fw-600 border-0 text-center">Dormant depuis</th>
                      <th className="fs-12 fw-600 border-0 text-end">Prix gros actuel</th>
                      <th className="fs-12 fw-600 border-0 text-end">Prix gros suggéré</th>
                      <th className="fs-12 fw-600 border-0 text-end">Marge estimée</th>
                      <th className="fs-12 fw-600 border-0 text-end pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map(s => (
                      <tr key={s.id}>
                        <td className="ps-3 align-middle">
                          <div className="fw-600 fs-13">{s.product_unit.product.name}</div>
                          <div className="fs-11 text-muted">{s.product_unit.label}</div>
                        </td>
                        <td className="align-middle text-center">
                          <span className="badge" style={{background:'#ecfeff',color:'#0891b2',fontSize:11}}>
                            {s.dormant_days} jours
                          </span>
                        </td>
                        <td className="align-middle text-end fs-13 text-muted">{fmt(s.current_price_wholesale)}</td>
                        <td className="align-middle text-end fw-700 fs-13" style={{color:'#F97316'}}>{fmt(s.suggested_price_wholesale)}</td>
                        <td className="align-middle text-end fs-13">{s.estimated_margin}%</td>
                        <td className="align-middle text-end pe-3">
                          <div className="d-flex gap-1 justify-content-end">
                            <button className="btn btn-sm" disabled={acting === s.id}
                              onClick={() => acceptSuggestion(s)}
                              style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:6,fontSize:12}}>
                              {acting === s.id ? <span className="spinner-border spinner-border-sm"/> : <i className="ti ti-check"/>}
                            </button>
                            <button className="btn btn-sm" disabled={acting === s.id}
                              onClick={() => openReject(s)}
                              style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,fontSize:12}}>
                              <i className="ti ti-x"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-x me-2" style={{color:'#dc2626'}}/>
                  Rejeter la suggestion
                </h5>
                <button className="btn-close" onClick={() => setRejectTarget(null)}/>
              </div>
              <div className="modal-body">
                <p className="fs-13 text-muted mb-3">
                  {rejectTarget.product_unit.product.name} — {rejectTarget.product_unit.label}
                </p>
                <label className="form-label fs-13 fw-600">Raison (optionnel)</label>
                <textarea className="form-control" rows={3} placeholder="Pourquoi rejeter cette suggestion ?"
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)}/>
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4"
                  style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                  onClick={() => setRejectTarget(null)}>Annuler</button>
                <button className="btn btn-sm px-4" disabled={acting === rejectTarget.id}
                  onClick={confirmReject}
                  style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                  {acting === rejectTarget.id ? <span className="spinner-border spinner-border-sm"/> : 'Confirmer le rejet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
