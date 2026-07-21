import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';

interface Credit {
  id: number;
  amount_due: string;
  amount_paid: string;
  amount_remaining: string;
  due_date: string;
  credit_days: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'doubtful';
  notes: string | null;
  client: { id: number; name: string; firstname: string; phone: string };
  sale: { invoice_number: string; sold_at: string };
  payments: any[];
}

interface Stats {
  total_due: number;
  total_overdue: number;
  nb_debtors: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label:'En attente',  color:'#0891b2', bg:'#ecfeff' },
  partial:  { label:'Partiel',     color:'#d97706', bg:'#fffbeb' },
  paid:     { label:'Soldé',       color:'#16a34a', bg:'#f0fdf4' },
  overdue:  { label:'En retard',   color:'#dc2626', bg:'#fef2f2' },
  doubtful: { label:'Douteux',     color:'#7c3aed', bg:'#f5f3ff' },
};

const fmt = (n: string | number) =>
  new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';

const Credits: React.FC = () => {
  const navigate = useNavigate();
  const [credits,    setCredits]    = useState<Credit[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [filter,     setFilter]     = useState('');
  const [selected,   setSelected]   = useState<Credit | null>(null);
  const [payForm,    setPayForm]     = useState({ amount:'', payment_method:'cash', notes:'' });
  const [paying,     setPaying]     = useState(false);

  useEffect(() => { load(); }, [filter]);

  const load = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter) params.status = filter;
      const res = await api.get<{ stats: Stats; data: any }>('/credits', params);
      setStats(res.stats);
      setCredits(res.data?.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setPaying(true);
    setError(null);
    try {
      await api.post(`/credits/${selected.id}/payments`, payForm);
      setSuccess('Paiement enregistré !');
      setSelected(null);
      setPayForm({ amount:'', payment_method:'cash', notes:'' });
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setPaying(false); }
  };

  const daysOverdue = (dueDate: string) => {
    const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Crédits</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Finance</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Crédits</li>
          </ol>
        </div>
      </div>

      {success && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,color:'#16a34a'}}>
          <i className="ti ti-circle-check"/>{success}
        </div>
      )}
      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
          <button className="btn-close ms-auto" onClick={() => setError(null)}/>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="kpi-label mb-1">Total restant dû</p>
                  <h3 className="kpi-value" style={{color:'#dc2626'}}>{fmt(stats.total_due)}</h3>
                </div>
                <div className="kpi-icon" style={{background:'#fef2f2',color:'#dc2626'}}>
                  <i className="ti ti-credit-card"/>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="kpi-card" style={{borderLeftColor:'#EA580C'}}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="kpi-label mb-1">Montant en retard</p>
                  <h3 className="kpi-value" style={{color:'#EA580C'}}>{fmt(stats.total_overdue)}</h3>
                </div>
                <div className="kpi-icon" style={{background:'#fff7ed',color:'#EA580C'}}>
                  <i className="ti ti-clock-exclamation"/>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="kpi-card">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="kpi-label mb-1">Nombre de débiteurs</p>
                  <h3 className="kpi-value">{stats.nb_debtors}</h3>
                </div>
                <div className="kpi-icon">
                  <i className="ti ti-users"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="d-flex gap-2 flex-wrap">
            {[
              { value:'',         label:'Tous' },
              { value:'pending',  label:'En attente' },
              { value:'partial',  label:'Partiel' },
              { value:'overdue',  label:'En retard' },
              { value:'doubtful', label:'Douteux' },
            ].map(f => (
              <button key={f.value} className="btn btn-sm"
                style={{
                  background: filter===f.value ? '#F97316' : '#f3f4f6',
                  color:      filter===f.value ? '#fff'    : '#374151',
                  border:'none', borderRadius:20, padding:'6px 14px', fontWeight:600, fontSize:12
                }}
                onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
            </div>
          ) : credits.length === 0 ? (
            <div className="text-center py-5">
              <i className="ti ti-credit-card d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">Aucun crédit trouvé</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Client</th>
                    <th className="fs-12 fw-600 border-0">Facture</th>
                    <th className="fs-12 fw-600 border-0">Montant dû</th>
                    <th className="fs-12 fw-600 border-0">Payé</th>
                    <th className="fs-12 fw-600 border-0">Restant</th>
                    <th className="fs-12 fw-600 border-0">Échéance</th>
                    <th className="fs-12 fw-600 border-0">Statut</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {credits.map(c => {
                    const cfg     = statusConfig[c.status];
                    const overdue = daysOverdue(c.due_date);
                    return (
                      <tr key={c.id}>
                        <td className="ps-3 align-middle">
                          <div className="fw-600 fs-13">{c.client?.firstname} {c.client?.name}</div>
                          <div className="fs-11 text-muted">{c.client?.phone}</div>
                        </td>
                        <td className="align-middle fs-12 text-muted">{c.sale?.invoice_number}</td>
                        <td className="align-middle fs-13 fw-600">{fmt(c.amount_due)}</td>
                        <td className="align-middle fs-13" style={{color:'#16a34a'}}>{fmt(c.amount_paid)}</td>
                        <td className="align-middle fs-13 fw-600" style={{color:'#dc2626'}}>{fmt(c.amount_remaining)}</td>
                        <td className="align-middle">
                          <div className="fs-12">{fmtDate(c.due_date)}</div>
                          {overdue > 0 && (
                            <div className="fs-11" style={{color:'#dc2626'}}>
                              {overdue}j de retard
                            </div>
                          )}
                        </td>
                        <td className="align-middle">
                          <span className="badge" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,fontSize:11}}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="align-middle text-end pe-3">
                          <div className="d-flex gap-1 justify-content-end">
                            <button className="btn btn-sm" title="Voir détail"
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:12}}
                              onClick={() => navigate(all_routes.creditDetail.replace(':id', String(c.id)))}>
                              <i className="ti ti-eye"/>
                            </button>
                            {c.status !== 'paid' && (
                              <button className="btn btn-sm"
                                style={{background:'#F97316',color:'#fff',borderRadius:6,fontSize:12,border:'none'}}
                                onClick={() => { setSelected(c); setPayForm({amount:'',payment_method:'cash',notes:''}); }}>
                                <i className="ti ti-cash me-1"/>Encaisser
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal paiement */}
      {selected && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-cash me-2" style={{color:'#F97316'}}/>
                  Encaisser un paiement
                </h5>
                <button className="btn-close" onClick={() => setSelected(null)}/>
              </div>
              <form onSubmit={handlePay}>
                <div className="modal-body">
                  {/* Résumé crédit */}
                  <div className="p-3 mb-3 rounded-3" style={{background:'#fff7ed',border:'1px solid #FED7AA'}}>
                    <div className="fw-600 fs-14">{selected.client?.firstname} {selected.client?.name}</div>
                    <div className="fs-12 text-muted mb-2">Facture : {selected.sale?.invoice_number}</div>
                    <div className="d-flex justify-content-between">
                      <span className="fs-13">Montant total :</span>
                      <span className="fw-600">{fmt(selected.amount_due)}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="fs-13">Déjà payé :</span>
                      <span className="fw-600" style={{color:'#16a34a'}}>{fmt(selected.amount_paid)}</span>
                    </div>
                    <div className="d-flex justify-content-between border-top mt-2 pt-2" style={{borderColor:'#FED7AA'}}>
                      <span className="fs-13 fw-600">Reste à payer :</span>
                      <span className="fw-700 fs-16" style={{color:'#EA580C'}}>{fmt(selected.amount_remaining)}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Montant encaissé (FCFA) <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" min="1"
                      max={Number(selected.amount_remaining)}
                      placeholder={`Max: ${fmt(selected.amount_remaining)}`}
                      value={payForm.amount}
                      onChange={e => setPayForm(f=>({...f,amount:e.target.value}))} required/>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Mode de paiement</label>
                    <select className="form-select"
                      value={payForm.payment_method}
                      onChange={e => setPayForm(f=>({...f,payment_method:e.target.value}))}>
                      <option value="cash">Espèces</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="virement">Virement</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Notes</label>
                    <textarea className="form-control" rows={2} placeholder="Remarques..."
                      value={payForm.notes}
                      onChange={e => setPayForm(f=>({...f,notes:e.target.value}))}/>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4"
                    style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                    onClick={() => setSelected(null)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={paying}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {paying ? <><span className="spinner-border spinner-border-sm me-1"/>...</> : <><i className="ti ti-check me-1"/>Confirmer</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Credits;
