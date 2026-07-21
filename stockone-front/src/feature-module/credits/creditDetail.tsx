import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../core/services/apiService';

interface Payment {
  id: number;
  amount: string;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  received_by: { name: string; firstname: string } | null;
}

interface SaleItem {
  id: number;
  sale_type: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  product_unit: { label: string; product: { name: string } };
}

interface CreditDetail {
  id: number;
  amount_due: string;
  amount_paid: string;
  amount_remaining: string;
  due_date: string;
  credit_days: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'doubtful';
  notes: string | null;
  client: { id: number; name: string; firstname: string; phone: string; address: string | null };
  sale: { invoice_number: string; sold_at: string; items: SaleItem[] };
  payments: Payment[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label:'En attente',  color:'#0891b2', bg:'#ecfeff' },
  partial:  { label:'Partiel',     color:'#d97706', bg:'#fffbeb' },
  paid:     { label:'Soldé',       color:'#16a34a', bg:'#f0fdf4' },
  overdue:  { label:'En retard',   color:'#dc2626', bg:'#fef2f2' },
  doubtful: { label:'Douteux',     color:'#7c3aed', bg:'#f5f3ff' },
};

const paymentMethodLabels: Record<string, string> = {
  cash:'Espèces', mobile_money:'Mobile Money', virement:'Virement',
};

const saleTypeLabels: Record<string, string> = { gros:'Gros', detail:'Détail', extra:'Extra' };

const fmt = (n: string | number) => new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');
const fmtDateTime = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

const CreditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [credit,   setCredit]   = useState<CreditDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);

  const [showPay,  setShowPay]  = useState(false);
  const [payForm,  setPayForm]  = useState({ amount:'', payment_method:'cash', notes:'' });
  const [paying,   setPaying]   = useState(false);

  const [showExtend, setShowExtend] = useState(false);
  const [extendForm, setExtendForm] = useState({ days:'7', notes:'' });
  const [extending,  setExtending]  = useState(false);

  const [markingDoubtful, setMarkingDoubtful] = useState(false);
  const [showDoubtfulConfirm, setShowDoubtfulConfirm] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get<{ data: CreditDetail }>(`/credits/${id}`);
      setCredit(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const daysOverdue = (dueDate: string) => {
    const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credit) return;
    setPaying(true);
    setError(null);
    try {
      await api.post(`/credits/${credit.id}/payments`, payForm);
      setSuccess('Paiement enregistré.');
      setShowPay(false);
      setPayForm({ amount:'', payment_method:'cash', notes:'' });
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setPaying(false); }
  };

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credit) return;
    setExtending(true);
    setError(null);
    try {
      await api.post(`/credits/${credit.id}/extend`, { days: Number(extendForm.days), notes: extendForm.notes || undefined });
      setSuccess("Échéance prolongée.");
      setShowExtend(false);
      setExtendForm({ days:'7', notes:'' });
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setExtending(false); }
  };

  const handleMarkDoubtful = async () => {
    if (!credit) return;
    setMarkingDoubtful(true);
    setError(null);
    try {
      await api.post(`/credits/${credit.id}/doubtful`);
      setSuccess('Crédit marqué comme créance douteuse.');
      setShowDoubtfulConfirm(false);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setMarkingDoubtful(false); }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>;
  }

  if (error && !credit) {
    return (
      <div className="alert" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
        <i className="ti ti-alert-circle me-2"/>{error}
      </div>
    );
  }

  if (!credit) return null;

  const cfg = statusConfig[credit.status];
  const overdue = daysOverdue(credit.due_date);

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title d-flex align-items-center gap-2">
            <button className="btn btn-sm" onClick={() => navigate(-1)}
              style={{background:'#f3f4f6',border:'none',borderRadius:8}}>
              <i className="ti ti-arrow-left"/>
            </button>
            Crédit — {credit.sale?.invoice_number}
          </h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Finance</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Détail crédit</li>
          </ol>
        </div>
        <span className="badge" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,fontSize:13,padding:'8px 14px'}}>
          {cfg.label}
        </span>
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

      <div className="row g-3">
        {/* Colonne principale */}
        <div className="col-xl-8">
          {/* Résumé montants */}
          <div className="row g-3 mb-3">
            <div className="col-4">
              <div className="kpi-card">
                <p className="kpi-label mb-1">Montant total</p>
                <h3 className="kpi-value">{fmt(credit.amount_due)}</h3>
              </div>
            </div>
            <div className="col-4">
              <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
                <p className="kpi-label mb-1">Payé</p>
                <h3 className="kpi-value" style={{color:'#16a34a'}}>{fmt(credit.amount_paid)}</h3>
              </div>
            </div>
            <div className="col-4">
              <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
                <p className="kpi-label mb-1">Restant dû</p>
                <h3 className="kpi-value" style={{color:'#dc2626'}}>{fmt(credit.amount_remaining)}</h3>
              </div>
            </div>
          </div>

          {/* Articles de la vente */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-0">
              <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                  <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>
                  Articles vendus — {credit.sale?.invoice_number}
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead style={{background:'#f8f9fa'}}>
                    <tr>
                      <th className="fs-11 fw-600 border-0 ps-3">Produit</th>
                      <th className="fs-11 fw-600 border-0">Type</th>
                      <th className="fs-11 fw-600 border-0 text-center">Qté</th>
                      <th className="fs-11 fw-600 border-0 text-end pe-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credit.sale?.items?.map(it => (
                      <tr key={it.id}>
                        <td className="ps-3 fs-13">{it.product_unit.product.name} — {it.product_unit.label}</td>
                        <td className="fs-12">{saleTypeLabels[it.sale_type] || it.sale_type}</td>
                        <td className="text-center fs-13">{it.quantity}</td>
                        <td className="text-end pe-3 fs-13 fw-600">{fmt(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Historique paiements */}
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                  <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>
                  Historique des paiements
                </h6>
              </div>
              {credit.payments.length === 0 ? (
                <div className="text-center py-4"><p className="text-muted fs-13">Aucun paiement enregistré</p></div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead style={{background:'#f8f9fa'}}>
                      <tr>
                        <th className="fs-12 fw-600 border-0 ps-3">Date</th>
                        <th className="fs-12 fw-600 border-0">Mode</th>
                        <th className="fs-12 fw-600 border-0 text-end">Montant</th>
                        <th className="fs-12 fw-600 border-0">Reçu par</th>
                        <th className="fs-12 fw-600 border-0 pe-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credit.payments.map(p => (
                        <tr key={p.id}>
                          <td className="ps-3 align-middle fs-13">{fmtDateTime(p.paid_at)}</td>
                          <td className="align-middle fs-12">{paymentMethodLabels[p.payment_method] || p.payment_method}</td>
                          <td className="align-middle text-end fw-600 fs-13" style={{color:'#16a34a'}}>{fmt(p.amount)}</td>
                          <td className="align-middle fs-12">{p.received_by ? `${p.received_by.firstname} ${p.received_by.name}` : '—'}</td>
                          <td className="align-middle pe-3 fs-12 text-muted">{p.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="col-xl-4">
          {/* Client */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h6 className="fw-700 mb-2 fs-13">Client</h6>
              <div className="fw-600 fs-14">{credit.client.firstname} {credit.client.name}</div>
              <div className="fs-13 text-muted">{credit.client.phone}</div>
              {credit.client.address && <div className="fs-12 text-muted mt-1">{credit.client.address}</div>}
            </div>
          </div>

          {/* Échéance */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h6 className="fw-700 mb-2 fs-13">Échéance</h6>
              <div className="fs-14 fw-600">{fmtDate(credit.due_date)}</div>
              {overdue > 0 && credit.status !== 'paid' && (
                <div className="fs-13 mt-1" style={{color:'#dc2626'}}>{overdue} jour{overdue > 1 ? 's' : ''} de retard</div>
              )}
              <div className="fs-12 text-muted mt-1">Délai initial : {credit.credit_days} jours</div>
              {credit.notes && <div className="fs-12 text-muted mt-2 pt-2" style={{borderTop:'1px solid #f3f4f6'}}>{credit.notes}</div>}
            </div>
          </div>

          {/* Actions */}
          {credit.status !== 'paid' && (
            <div className="card border-0 shadow-sm">
              <div className="card-body d-flex flex-column gap-2">
                <button className="btn" onClick={() => setShowPay(true)}
                  style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'10px',fontWeight:600}}>
                  <i className="ti ti-cash me-2"/>Encaisser un paiement
                </button>
                <button className="btn" onClick={() => setShowExtend(true)}
                  style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'10px',fontWeight:600}}>
                  <i className="ti ti-calendar-plus me-2"/>Prolonger l'échéance
                </button>
                {credit.status !== 'doubtful' && (
                  <button className="btn" onClick={() => setShowDoubtfulConfirm(true)}
                    style={{background:'#f5f3ff',color:'#7c3aed',border:'none',borderRadius:8,padding:'10px',fontWeight:600}}>
                    <i className="ti ti-alert-octagon me-2"/>Marquer douteux
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal paiement */}
      {showPay && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-cash me-2" style={{color:'#F97316'}}/>Encaisser un paiement</h5>
                <button className="btn-close" onClick={() => setShowPay(false)}/>
              </div>
              <form onSubmit={handlePay}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Montant (max {fmt(credit.amount_remaining)}) <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" min="1" max={Number(credit.amount_remaining)} required
                      value={payForm.amount} onChange={e => setPayForm(f=>({...f,amount:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Mode de paiement</label>
                    <select className="form-select" value={payForm.payment_method}
                      onChange={e => setPayForm(f=>({...f,payment_method:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                      <option value="cash">Espèces</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="virement">Virement</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Notes</label>
                    <textarea className="form-control" rows={2} value={payForm.notes}
                      onChange={e => setPayForm(f=>({...f,notes:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setShowPay(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={paying}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {paying ? <span className="spinner-border spinner-border-sm"/> : 'Confirmer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal prolongation */}
      {showExtend && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-calendar-plus me-2" style={{color:'#F97316'}}/>Prolonger l'échéance</h5>
                <button className="btn-close" onClick={() => setShowExtend(false)}/>
              </div>
              <form onSubmit={handleExtend}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <p className="fs-13 text-muted mb-3">Échéance actuelle : {fmtDate(credit.due_date)}</p>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Jours supplémentaires <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" min="1" max="90" required
                      value={extendForm.days} onChange={e => setExtendForm(f=>({...f,days:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Notes</label>
                    <textarea className="form-control" rows={2} value={extendForm.notes}
                      onChange={e => setExtendForm(f=>({...f,notes:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setShowExtend(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={extending}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {extending ? <span className="spinner-border spinner-border-sm"/> : 'Prolonger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal marquer douteux */}
      {showDoubtfulConfirm && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700" style={{color:'#7c3aed'}}><i className="ti ti-alert-octagon me-2"/>Marquer comme créance douteuse</h5>
                <button className="btn-close" onClick={() => setShowDoubtfulConfirm(false)}/>
              </div>
              <div className="modal-body">
                <p className="fs-14">
                  Marquer ce crédit de <strong>{credit.client.firstname} {credit.client.name}</strong> comme créance douteuse ?
                </p>
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setShowDoubtfulConfirm(false)}>Annuler</button>
                <button className="btn btn-sm px-4" disabled={markingDoubtful} onClick={handleMarkDoubtful}
                  style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                  {markingDoubtful ? <span className="spinner-border spinner-border-sm"/> : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditDetailPage;
