import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';
import { API_BASE_URL } from '../../environment';

interface SaleListItem {
  id: number;
  invoice_number: string;
  sold_at: string;
  payment_mode: string;
  status: string;
  net_amount: string;
  amount_paid: string;
  amount_due: string;
  user: { name: string; firstname: string };
  client: { name: string; firstname: string; phone: string } | null;
  items: any[];
}

interface SaleDetail extends SaleListItem {
  total_amount: string;
  discount_amount: string;
  notes: string | null;
  items: {
    id: number;
    sale_type: string;
    quantity: number;
    unit_price: string;
    total_price: string;
    product_unit: { label: string; product: { name: string } };
  }[];
  extra_identity: { name: string; firstname: string; phone: string; remarks: string | null } | null;
  credit_sale: { status: string; due_date: string; amount_remaining: string; payments: any[] } | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label:'Complétée', color:'#16a34a', bg:'#f0fdf4' },
  on_hold:   { label:'En attente', color:'#d97706', bg:'#fffbeb' },
  cancelled: { label:'Annulée',    color:'#dc2626', bg:'#fef2f2' },
};

const paymentModeLabels: Record<string, string> = {
  cash: 'Espèces', credit: 'Crédit', mobile_money: 'Mobile Money', mixed: 'Mixte',
};

const saleTypeLabels: Record<string, string> = { gros:'Gros', detail:'Détail', extra:'Extra' };

const fmt = (n: string | number) => new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

const getToken = (): string | null => localStorage.getItem('stockone_token');
const getShopId = (): number | null => {
  const user = JSON.parse(localStorage.getItem('stockone_user') || 'null');
  return user?.role === 'super_admin' ? null : user?.shop?.id ?? null;
};

const SalesList: React.FC = () => {
  const [sales,   setSales]   = useState<SaleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filters, setFilters] = useState({ date:'', payment_mode:'', status:'' });

  const [detail,        setDetail]        = useState<SaleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<SaleListItem | null>(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [holdingId,    setHoldingId]    = useState<number | null>(null);
  const [printingId,   setPrintingId]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.date)          params.date = filters.date;
      if (filters.payment_mode)  params.payment_mode = filters.payment_mode;
      if (filters.status)        params.status = filters.status;
      const res = await api.get<any>('/sales', params);
      setSales(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openDetail = async (s: SaleListItem) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await api.get<{ data: SaleDetail }>(`/sales/${s.id}`);
      setDetail(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingDetail(false); }
  };

  const handleHold = async (s: SaleListItem) => {
    setHoldingId(s.id);
    setError(null);
    try {
      await api.post(`/sales/${s.id}/hold`);
      setSuccess('Vente mise en attente.');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setHoldingId(null); }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setError(null);
    try {
      await api.post(`/sales/${cancelTarget.id}/cancel`);
      setSuccess('Vente annulée et stock restauré.');
      setCancelTarget(null);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setCancelling(false); }
  };

  const handlePrint = async (saleId: number, format: 'a4' | 'ticket') => {
    const key = `${saleId}-${format}`;
    setPrintingId(key);
    setError(null);
    try {
      const url = new URL(`${API_BASE_URL}/invoices/${saleId}/${format === 'a4' ? 'a4' : 'ticket'}`);
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
      const filename = match ? match[1].replace(/"/g,'') : `facture-${saleId}.pdf`;

      const link = document.createElement('a');
      const objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'impression.");
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Liste des Ventes</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Ventes</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Historique</li>
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

      {/* Filtres */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Date</label>
              <input type="date" className="form-control form-control-sm" value={filters.date}
                onChange={e => setFilters(f=>({...f,date:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
            </div>
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Mode paiement</label>
              <select className="form-select form-select-sm" value={filters.payment_mode}
                onChange={e => setFilters(f=>({...f,payment_mode:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                <option value="">Tous</option>
                <option value="cash">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="credit">Crédit</option>
                <option value="mixed">Mixte</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Statut</label>
              <select className="form-select form-select-sm" value={filters.status}
                onChange={e => setFilters(f=>({...f,status:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                <option value="">Tous</option>
                <option value="completed">Complétée</option>
                <option value="on_hold">En attente</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-sm flex-fill" onClick={load}
                style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8}}>
                <i className="ti ti-search me-1"/>Filtrer
              </button>
              <button className="btn btn-sm" onClick={() => { setFilters({date:'',payment_mode:'',status:''}); setTimeout(load,50); }}
                style={{background:'#f3f4f6',border:'none',borderRadius:8}}>
                <i className="ti ti-x"/>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
          ) : sales.length === 0 ? (
            <div className="text-center py-5">
              <i className="ti ti-receipt d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">Aucune vente trouvée</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Facture</th>
                    <th className="fs-12 fw-600 border-0">Date</th>
                    <th className="fs-12 fw-600 border-0">Caissier</th>
                    <th className="fs-12 fw-600 border-0">Client</th>
                    <th className="fs-12 fw-600 border-0">Mode</th>
                    <th className="fs-12 fw-600 border-0 text-end">Net</th>
                    <th className="fs-12 fw-600 border-0 text-end">Dû</th>
                    <th className="fs-12 fw-600 border-0">Statut</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => {
                    const cfg = statusConfig[s.status] || { label:s.status, color:'#6b7280', bg:'#f3f4f6' };
                    return (
                      <tr key={s.id}>
                        <td className="ps-3 align-middle fw-600 fs-13" style={{cursor:'pointer'}} onClick={() => openDetail(s)}>
                          {s.invoice_number}
                        </td>
                        <td className="align-middle fs-12 text-muted">{fmtDate(s.sold_at)}</td>
                        <td className="align-middle fs-13">{s.user?.firstname} {s.user?.name}</td>
                        <td className="align-middle fs-13">{s.client ? `${s.client.firstname} ${s.client.name}` : 'Anonyme'}</td>
                        <td className="align-middle fs-12">{paymentModeLabels[s.payment_mode] || s.payment_mode}</td>
                        <td className="align-middle text-end fw-600 fs-13">{fmt(s.net_amount)}</td>
                        <td className="align-middle text-end fs-13" style={{color: Number(s.amount_due) > 0 ? '#dc2626' : '#16a34a'}}>
                          {fmt(s.amount_due)}
                        </td>
                        <td className="align-middle">
                          <span className="badge" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,fontSize:11}}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="align-middle text-end pe-3">
                          <div className="d-flex gap-1 justify-content-end flex-wrap">
                            <button className="btn btn-sm" title="Détail" onClick={() => openDetail(s)}
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:11}}>
                              <i className="ti ti-eye"/>
                            </button>
                            <button className="btn btn-sm" title="Facture A4" disabled={printingId === `${s.id}-a4`}
                              onClick={() => handlePrint(s.id, 'a4')}
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:11}}>
                              {printingId === `${s.id}-a4` ? <span className="spinner-border spinner-border-sm"/> : <i className="ti ti-file-invoice"/>}
                            </button>
                            <button className="btn btn-sm" title="Ticket 80mm" disabled={printingId === `${s.id}-ticket`}
                              onClick={() => handlePrint(s.id, 'ticket')}
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:11}}>
                              {printingId === `${s.id}-ticket` ? <span className="spinner-border spinner-border-sm"/> : <i className="ti ti-receipt"/>}
                            </button>
                            {s.status === 'completed' && (
                              <>
                                <button className="btn btn-sm" title="Mettre en attente" disabled={holdingId === s.id}
                                  onClick={() => handleHold(s)}
                                  style={{background:'#fffbeb',color:'#d97706',border:'none',borderRadius:6,fontSize:11}}>
                                  {holdingId === s.id ? <span className="spinner-border spinner-border-sm"/> : <i className="ti ti-player-pause"/>}
                                </button>
                                <button className="btn btn-sm" title="Annuler" onClick={() => setCancelTarget(s)}
                                  style={{background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:11}}>
                                  <i className="ti ti-x"/>
                                </button>
                              </>
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

      {/* Modal détail */}
      {(detail || loadingDetail) && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-receipt me-2" style={{color:'#F97316'}}/>
                  {detail ? detail.invoice_number : 'Chargement...'}
                </h5>
                <button className="btn-close" onClick={() => setDetail(null)}/>
              </div>
              <div className="modal-body">
                {loadingDetail || !detail ? (
                  <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <div className="fs-11 text-muted">Date</div>
                        <div className="fs-13 fw-600">{fmtDate(detail.sold_at)}</div>
                      </div>
                      <div className="col-6">
                        <div className="fs-11 text-muted">Caissier</div>
                        <div className="fs-13 fw-600">{detail.user?.firstname} {detail.user?.name}</div>
                      </div>
                      <div className="col-6">
                        <div className="fs-11 text-muted">Client</div>
                        <div className="fs-13 fw-600">{detail.client ? `${detail.client.firstname} ${detail.client.name} (${detail.client.phone})` : 'Anonyme'}</div>
                      </div>
                      <div className="col-6">
                        <div className="fs-11 text-muted">Mode de paiement</div>
                        <div className="fs-13 fw-600">{paymentModeLabels[detail.payment_mode] || detail.payment_mode}</div>
                      </div>
                    </div>

                    {detail.extra_identity && (
                      <div className="p-2 mb-3 rounded-3" style={{background:'#fff7ed',border:'1px solid #FED7AA'}}>
                        <div className="fs-11 fw-600" style={{color:'#F97316'}}>Identité acheteur Extra</div>
                        <div className="fs-13">{detail.extra_identity.firstname} {detail.extra_identity.name} — {detail.extra_identity.phone}</div>
                        {detail.extra_identity.remarks && <div className="fs-12 text-muted">{detail.extra_identity.remarks}</div>}
                      </div>
                    )}

                    <div className="table-responsive mb-3">
                      <table className="table table-sm mb-0">
                        <thead style={{background:'#f8f9fa'}}>
                          <tr>
                            <th className="fs-11 fw-600 border-0">Produit</th>
                            <th className="fs-11 fw-600 border-0">Type</th>
                            <th className="fs-11 fw-600 border-0 text-center">Qté</th>
                            <th className="fs-11 fw-600 border-0 text-end">P.U.</th>
                            <th className="fs-11 fw-600 border-0 text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.items.map(it => (
                            <tr key={it.id}>
                              <td className="fs-13">{it.product_unit.product.name} — {it.product_unit.label}</td>
                              <td className="fs-12">{saleTypeLabels[it.sale_type] || it.sale_type}</td>
                              <td className="text-center fs-13">{it.quantity}</td>
                              <td className="text-end fs-13">{fmt(it.unit_price)}</td>
                              <td className="text-end fs-13 fw-600">{fmt(it.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 rounded-3" style={{background:'#f8f9fa'}}>
                      <div className="d-flex justify-content-between fs-13"><span>Total</span><span>{fmt(detail.total_amount)}</span></div>
                      <div className="d-flex justify-content-between fs-13"><span>Remise</span><span>-{fmt(detail.discount_amount)}</span></div>
                      <div className="d-flex justify-content-between fw-700 fs-14 pt-1 mt-1" style={{borderTop:'1px solid #e5e7eb'}}>
                        <span>Net</span><span style={{color:'#F97316'}}>{fmt(detail.net_amount)}</span>
                      </div>
                      <div className="d-flex justify-content-between fs-13"><span>Payé</span><span style={{color:'#16a34a'}}>{fmt(detail.amount_paid)}</span></div>
                      <div className="d-flex justify-content-between fs-13"><span>Dû</span><span style={{color:'#dc2626'}}>{fmt(detail.amount_due)}</span></div>
                    </div>

                    {detail.credit_sale && (
                      <div className="p-2 mt-3 rounded-3" style={{background:'#f5f3ff'}}>
                        <div className="fs-11 fw-600" style={{color:'#7c3aed'}}>Crédit associé</div>
                        <div className="fs-13">Statut : {detail.credit_sale.status} — Reste dû : {fmt(detail.credit_sale.amount_remaining)}</div>
                        <div className="fs-12 text-muted">Échéance : {new Date(detail.credit_sale.due_date).toLocaleDateString('fr-FR')}</div>
                      </div>
                    )}

                    {detail.notes && (
                      <div className="fs-12 text-muted mt-2">Notes : {detail.notes}</div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setDetail(null)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal annulation */}
      {cancelTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700" style={{color:'#dc2626'}}><i className="ti ti-alert-triangle me-2"/>Annuler la vente</h5>
                <button className="btn-close" onClick={() => setCancelTarget(null)}/>
              </div>
              <div className="modal-body">
                <p className="fs-14">
                  Annuler la vente <strong>{cancelTarget.invoice_number}</strong> ? Le stock sera automatiquement restauré.
                </p>
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setCancelTarget(null)}>Retour</button>
                <button className="btn btn-sm px-4" disabled={cancelling} onClick={confirmCancel}
                  style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                  {cancelling ? <span className="spinner-border spinner-border-sm"/> : 'Confirmer l\'annulation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesList;
