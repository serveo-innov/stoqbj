import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../core/services/apiService';
import { setActiveShop } from '../../core/redux/activeShopSlice';
import { all_routes } from '../router/all_routes';

interface Shop {
  id: number;
  shop_name: string;
  commercial_name: string | null;
  owner_name: string;
  owner_firstname: string;
  owner_email: string;
  owner_phone: string;
  address: string;
  city: string;
  neighborhood: string | null;
  status: 'trial' | 'active' | 'suspended' | 'closed';
  subscription_start: string | null;
  subscription_end: string | null;
  users_count: number;
}

interface ShopStats {
  total_shops: number;
  active_shops: number;
  trial_shops: number;
  suspended_shops: number;
  expiring_soon: number;
}

interface Payment {
  id: number;
  amount: string;
  payment_method: string;
  transaction_ref: string | null;
  payment_date: string;
  period_start: string;
  period_end: string;
  status: string;
  notes: string | null;
  validated_by: { name: string; firstname: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  trial:     { label:'Essai',      color:'#d97706', bg:'#fffbeb' },
  active:    { label:'Active',     color:'#16a34a', bg:'#f0fdf4' },
  suspended: { label:'Suspendue',  color:'#dc2626', bg:'#fef2f2' },
  closed:    { label:'Fermée',     color:'#6b7280', bg:'#f3f4f6' },
};

const fmt = (n: string | number) => new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const emptyCreateForm = {
  shop_name:'', commercial_name:'', owner_name:'', owner_firstname:'', owner_phone:'',
  owner_email:'', address:'', city:'', neighborhood:'', ifu_number:'', rccm_number:'',
  brand_color:'#1a73e8', trial_days:'14', admin_password:'',
};

const emptyEditForm = {
  shop_name:'', commercial_name:'', owner_phone:'', owner_phone_secondary:'',
  address:'', city:'', neighborhood:'', ifu_number:'', rccm_number:'',
  brand_color:'', slogan:'', default_credit_days:'',
};

const emptyActivateForm = {
  amount:'35000', payment_method:'mobile_money_mtn', transaction_ref:'',
  payment_date: new Date().toISOString().slice(0,10),
  period_start: new Date().toISOString().slice(0,10),
  period_end:'', notes:'',
};

const AdminShops: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [shops,   setShops]   = useState<Shop[]>([]);
  const [stats,   setStats]   = useState<ShopStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search,        setSearch]       = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating,   setCreating]   = useState(false);

  const [editTarget, setEditTarget] = useState<Shop | null>(null);
  const [editForm,   setEditForm]   = useState(emptyEditForm);
  const [editing,    setEditing]    = useState(false);
  const [editFetchingId, setEditFetchingId] = useState<number | null>(null);

  const [activateTarget, setActivateTarget] = useState<Shop | null>(null);
  const [activateForm,   setActivateForm]   = useState(emptyActivateForm);
  const [activating,     setActivating]     = useState(false);

  const [suspendTarget, setSuspendTarget] = useState<Shop | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending,    setSuspending]    = useState(false);
  const [reactivatingId,setReactivatingId]= useState<number | null>(null);

  const [paymentsTarget, setPaymentsTarget] = useState<Shop | null>(null);
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [loadingPayments,setLoadingPayments]= useState(false);

  useEffect(() => { load(); }, [statusFilter]);

  const load = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search)       params.search = search;
      const res = await api.get<{ stats: ShopStats; data: any }>('/admin/shops', params);
      setStats(res.stats);
      setShops(res.data?.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload: any = { ...createForm, trial_days: Number(createForm.trial_days) };
      if (!payload.commercial_name) delete payload.commercial_name;
      if (!payload.neighborhood)    delete payload.neighborhood;
      if (!payload.ifu_number)      delete payload.ifu_number;
      if (!payload.rccm_number)     delete payload.rccm_number;
      await api.post('/admin/shops', payload);
      setSuccess('Boutique créée avec succès.');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  // Va chercher le détail complet (IFU, RCCM, couleur, slogan, délai crédit...)
  // avant d'ouvrir le formulaire, pour ne jamais présenter des champs vides à tort.
  const openEdit = async (s: Shop) => {
    setEditFetchingId(s.id);
    setError(null);
    try {
      const res = await api.get<{ data: any }>(`/admin/shops/${s.id}`);
      const shop = res.data;
      setEditTarget(s);
      setEditForm({
        shop_name:             shop.shop_name || '',
        commercial_name:       shop.commercial_name || '',
        owner_phone:           shop.owner_phone || '',
        owner_phone_secondary: shop.owner_phone_secondary || '',
        address:                shop.address || '',
        city:                   shop.city || '',
        neighborhood:           shop.neighborhood || '',
        ifu_number:             shop.ifu_number || '',
        rccm_number:            shop.rccm_number || '',
        brand_color:            shop.brand_color || '',
        slogan:                 shop.slogan || '',
        default_credit_days:    shop.default_credit_days ? String(shop.default_credit_days) : '',
      });
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les détails de la boutique.');
    } finally {
      setEditFetchingId(null);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditing(true);
    setError(null);
    try {
      const payload: any = {};
      Object.entries(editForm).forEach(([k, v]) => { if (v !== '') payload[k] = k === 'default_credit_days' ? Number(v) : v; });
      await api.put(`/admin/shops/${editTarget.id}`, payload);
      setSuccess('Boutique modifiée.');
      setEditTarget(null);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setEditing(false); }
  };

  const openActivate = (s: Shop) => { setActivateTarget(s); setActivateForm(emptyActivateForm); setError(null); };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activateTarget) return;
    setActivating(true);
    setError(null);
    try {
      await api.post(`/admin/shops/${activateTarget.id}/activate`, {
        ...activateForm,
        amount: activateForm.amount ? Number(activateForm.amount) : undefined,
      });
      setSuccess('Abonnement activé.');
      setActivateTarget(null);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setActivating(false); }
  };

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    setSuspending(true);
    setError(null);
    try {
      await api.post(`/admin/shops/${suspendTarget.id}/suspend`, { reason: suspendReason || undefined });
      setSuccess('Boutique suspendue.');
      setSuspendTarget(null);
      setSuspendReason('');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSuspending(false); }
  };

  const reactivate = async (s: Shop) => {
    setReactivatingId(s.id);
    setError(null);
    try {
      await api.post(`/admin/shops/${s.id}/reactivate`);
      setSuccess('Boutique réactivée.');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setReactivatingId(null); }
  };

  const enterShop = (s: Shop) => {
    dispatch(setActiveShop({ id: s.id, name: s.commercial_name || s.shop_name }));
    navigate(all_routes.dashboard);
  };

  const openPayments = async (s: Shop) => {
    setPaymentsTarget(s);
    setLoadingPayments(true);
    try {
      const res = await api.get<{ payments: Payment[] }>(`/admin/shops/${s.id}/payments`);
      setPayments(res.payments);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingPayments(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Boutiques</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Super Admin</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Boutiques</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2"
          onClick={() => { setShowCreate(true); setCreateForm(emptyCreateForm); setError(null); }}
          style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>
          <i className="ti ti-building-store fs-16"/>Nouvelle boutique
        </button>
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

      {/* Stats */}
      {stats && (
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="kpi-card"><p className="kpi-label mb-1">Total</p><h3 className="kpi-value">{stats.total_shops}</h3></div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}><p className="kpi-label mb-1">Actives</p><h3 className="kpi-value" style={{color:'#16a34a'}}>{stats.active_shops}</h3></div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#d97706'}}><p className="kpi-label mb-1">En essai</p><h3 className="kpi-value" style={{color:'#d97706'}}>{stats.trial_shops}</h3></div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}><p className="kpi-label mb-1">Suspendues</p><h3 className="kpi-value" style={{color:'#dc2626'}}>{stats.suspended_shops}</h3></div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <form onSubmit={handleSearch} className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label fs-12 fw-600">Recherche</label>
              <input type="text" className="form-control form-control-sm" placeholder="Nom, propriétaire, ville..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{borderColor:'#e5e7eb',borderRadius:8}}/>
            </div>
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Statut</label>
              <select className="form-select form-select-sm" value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{borderColor:'#e5e7eb',borderRadius:8}}>
                <option value="">Tous</option>
                <option value="trial">Essai</option>
                <option value="active">Active</option>
                <option value="suspended">Suspendue</option>
                <option value="closed">Fermée</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-sm w-100"
                style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8}}>
                <i className="ti ti-search me-1"/>Filtrer
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Tableau */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
          ) : shops.length === 0 ? (
            <div className="text-center py-5">
              <i className="ti ti-building-store d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">Aucune boutique trouvée</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Boutique</th>
                    <th className="fs-12 fw-600 border-0">Propriétaire</th>
                    <th className="fs-12 fw-600 border-0">Ville</th>
                    <th className="fs-12 fw-600 border-0 text-center">Users</th>
                    <th className="fs-12 fw-600 border-0">Statut</th>
                    <th className="fs-12 fw-600 border-0">Expire le</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map(s => {
                    const cfg = statusConfig[s.status];
                    return (
                      <tr key={s.id}>
                        <td className="ps-3 align-middle">
                          <div className="fw-600 fs-13">{s.commercial_name || s.shop_name}</div>
                          <div className="fs-11 text-muted">{s.shop_name}</div>
                        </td>
                        <td className="align-middle">
                          <div className="fs-13">{s.owner_firstname} {s.owner_name}</div>
                          <div className="fs-11 text-muted">{s.owner_phone}</div>
                        </td>
                        <td className="align-middle fs-13">{s.city}</td>
                        <td className="align-middle text-center fs-13">{s.users_count}</td>
                        <td className="align-middle">
                          <span className="badge" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,fontSize:11}}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="align-middle fs-12 text-muted">{fmtDate(s.subscription_end)}</td>
                        <td className="align-middle text-end pe-3">
                          <div className="d-flex gap-1 justify-content-end flex-wrap">
                            <button className="btn btn-sm" title="Entrer dans la boutique" onClick={() => enterShop(s)}
                              style={{background:'#fff7ed',color:'#F97316',border:'none',borderRadius:6,fontSize:12,fontWeight:600}}>
                              <i className="ti ti-login-2 me-1"/>Entrer
                            </button>
                            <button className="btn btn-sm" title="Modifier" disabled={editFetchingId === s.id} onClick={() => openEdit(s)}
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:12}}>
                              {editFetchingId === s.id ? <span className="spinner-border spinner-border-sm"/> : <i className="ti ti-edit"/>}
                            </button>
                            <button className="btn btn-sm" title="Paiements" onClick={() => openPayments(s)}
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:12}}>
                              <i className="ti ti-receipt"/>
                            </button>
                            {s.status !== 'suspended' ? (
                              <>
                                <button className="btn btn-sm" title="Activer abonnement" onClick={() => openActivate(s)}
                                  style={{background:'#f0fdf4',color:'#16a34a',border:'none',borderRadius:6,fontSize:12}}>
                                  <i className="ti ti-rosette-discount-check"/>
                                </button>
                                <button className="btn btn-sm" title="Suspendre" onClick={() => setSuspendTarget(s)}
                                  style={{background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12}}>
                                  <i className="ti ti-player-pause"/>
                                </button>
                              </>
                            ) : (
                              <button className="btn btn-sm" title="Réactiver" disabled={reactivatingId === s.id} onClick={() => reactivate(s)}
                                style={{background:'#f0fdf4',color:'#16a34a',border:'none',borderRadius:6,fontSize:12}}>
                                {reactivatingId === s.id ? <span className="spinner-border spinner-border-sm"/> : <i className="ti ti-player-play"/>}
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

      {/* Modal création */}
      {showCreate && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-building-store me-2" style={{color:'#F97316'}}/>Nouvelle boutique</h5>
                <button className="btn-close" onClick={() => setShowCreate(false)}/>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Nom légal boutique <span className="text-danger">*</span></label>
                      <input className="form-control" required value={createForm.shop_name}
                        onChange={e => setCreateForm(f=>({...f,shop_name:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Nom commercial</label>
                      <input className="form-control" value={createForm.commercial_name}
                        onChange={e => setCreateForm(f=>({...f,commercial_name:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Nom propriétaire <span className="text-danger">*</span></label>
                      <input className="form-control" required value={createForm.owner_name}
                        onChange={e => setCreateForm(f=>({...f,owner_name:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Prénom propriétaire <span className="text-danger">*</span></label>
                      <input className="form-control" required value={createForm.owner_firstname}
                        onChange={e => setCreateForm(f=>({...f,owner_firstname:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Email <span className="text-danger">*</span></label>
                      <input type="email" className="form-control" required value={createForm.owner_email}
                        onChange={e => setCreateForm(f=>({...f,owner_email:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Téléphone <span className="text-danger">*</span></label>
                      <input className="form-control" required value={createForm.owner_phone}
                        onChange={e => setCreateForm(f=>({...f,owner_phone:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Adresse <span className="text-danger">*</span></label>
                    <input className="form-control" required value={createForm.address}
                      onChange={e => setCreateForm(f=>({...f,address:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Ville <span className="text-danger">*</span></label>
                      <input className="form-control" required value={createForm.city}
                        onChange={e => setCreateForm(f=>({...f,city:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Quartier</label>
                      <input className="form-control" value={createForm.neighborhood}
                        onChange={e => setCreateForm(f=>({...f,neighborhood:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">N° IFU</label>
                      <input className="form-control" value={createForm.ifu_number}
                        onChange={e => setCreateForm(f=>({...f,ifu_number:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">N° RCCM</label>
                      <input className="form-control" value={createForm.rccm_number}
                        onChange={e => setCreateForm(f=>({...f,rccm_number:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">Couleur de marque</label>
                      <input type="color" className="form-control form-control-color" value={createForm.brand_color}
                        onChange={e => setCreateForm(f=>({...f,brand_color:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8,width:'100%'}}/>
                    </div>
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">Jours d'essai</label>
                      <input type="number" className="form-control" min={1} max={90} value={createForm.trial_days}
                        onChange={e => setCreateForm(f=>({...f,trial_days:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">Mdp Admin <span className="text-danger">*</span></label>
                      <input type="password" className="form-control" required minLength={8} value={createForm.admin_password}
                        onChange={e => setCreateForm(f=>({...f,admin_password:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setShowCreate(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={creating}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {creating ? <span className="spinner-border spinner-border-sm"/> : 'Créer la boutique'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition */}
      {editTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-edit me-2" style={{color:'#F97316'}}/>Modifier {editTarget.shop_name}</h5>
                <button className="btn-close" onClick={() => setEditTarget(null)}/>
              </div>
              <form onSubmit={handleEdit}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Nom légal</label>
                      <input className="form-control" value={editForm.shop_name}
                        onChange={e => setEditForm(f=>({...f,shop_name:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Nom commercial</label>
                      <input className="form-control" value={editForm.commercial_name}
                        onChange={e => setEditForm(f=>({...f,commercial_name:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Téléphone</label>
                      <input className="form-control" value={editForm.owner_phone}
                        onChange={e => setEditForm(f=>({...f,owner_phone:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Téléphone secondaire</label>
                      <input className="form-control" value={editForm.owner_phone_secondary}
                        onChange={e => setEditForm(f=>({...f,owner_phone_secondary:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Adresse</label>
                    <input className="form-control" value={editForm.address}
                      onChange={e => setEditForm(f=>({...f,address:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Ville</label>
                      <input className="form-control" value={editForm.city}
                        onChange={e => setEditForm(f=>({...f,city:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Quartier</label>
                      <input className="form-control" value={editForm.neighborhood}
                        onChange={e => setEditForm(f=>({...f,neighborhood:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">N° IFU</label>
                      <input className="form-control" value={editForm.ifu_number}
                        onChange={e => setEditForm(f=>({...f,ifu_number:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">N° RCCM</label>
                      <input className="form-control" value={editForm.rccm_number}
                        onChange={e => setEditForm(f=>({...f,rccm_number:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">Délai crédit (j)</label>
                      <input type="number" className="form-control" value={editForm.default_credit_days}
                        onChange={e => setEditForm(f=>({...f,default_credit_days:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Slogan</label>
                    <input className="form-control" value={editForm.slogan}
                      onChange={e => setEditForm(f=>({...f,slogan:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setEditTarget(null)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={editing}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {editing ? <span className="spinner-border spinner-border-sm"/> : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal activation */}
      {activateTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-rosette-discount-check me-2" style={{color:'#16a34a'}}/>Activer l'abonnement</h5>
                <button className="btn-close" onClick={() => setActivateTarget(null)}/>
              </div>
              <form onSubmit={handleActivate}>
                <div className="modal-body">
                  <p className="fs-13 text-muted mb-3">{activateTarget.commercial_name || activateTarget.shop_name}</p>
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Montant (FCFA)</label>
                      <input type="number" className="form-control" value={activateForm.amount}
                        onChange={e => setActivateForm(f=>({...f,amount:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Mode de paiement <span className="text-danger">*</span></label>
                      <select className="form-select" required value={activateForm.payment_method}
                        onChange={e => setActivateForm(f=>({...f,payment_method:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                        <option value="mobile_money_mtn">Mobile Money MTN</option>
                        <option value="mobile_money_moov">Mobile Money Moov</option>
                        <option value="virement">Virement</option>
                        <option value="especes">Espèces</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Référence transaction</label>
                    <input className="form-control" value={activateForm.transaction_ref}
                      onChange={e => setActivateForm(f=>({...f,transaction_ref:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">Date paiement <span className="text-danger">*</span></label>
                      <input type="date" className="form-control" required value={activateForm.payment_date}
                        onChange={e => setActivateForm(f=>({...f,payment_date:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">Début période <span className="text-danger">*</span></label>
                      <input type="date" className="form-control" required value={activateForm.period_start}
                        onChange={e => setActivateForm(f=>({...f,period_start:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-4">
                      <label className="form-label fs-13 fw-600">Fin période <span className="text-danger">*</span></label>
                      <input type="date" className="form-control" required value={activateForm.period_end}
                        onChange={e => setActivateForm(f=>({...f,period_end:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Notes</label>
                    <textarea className="form-control" rows={2} value={activateForm.notes}
                      onChange={e => setActivateForm(f=>({...f,notes:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setActivateTarget(null)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={activating}
                    style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {activating ? <span className="spinner-border spinner-border-sm"/> : 'Activer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal suspension */}
      {suspendTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700" style={{color:'#dc2626'}}><i className="ti ti-player-pause me-2"/>Suspendre la boutique</h5>
                <button className="btn-close" onClick={() => setSuspendTarget(null)}/>
              </div>
              <div className="modal-body">
                <p className="fs-14 mb-3">
                  Suspendre <strong>{suspendTarget.commercial_name || suspendTarget.shop_name}</strong> ?
                  Tous les utilisateurs seront déconnectés immédiatement.
                </p>
                <label className="form-label fs-13 fw-600">Raison (optionnel)</label>
                <textarea className="form-control" rows={2} value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setSuspendTarget(null)}>Annuler</button>
                <button className="btn btn-sm px-4" disabled={suspending} onClick={confirmSuspend}
                  style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                  {suspending ? <span className="spinner-border spinner-border-sm"/> : 'Suspendre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal historique paiements */}
      {paymentsTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-receipt me-2" style={{color:'#F97316'}}/>Historique — {paymentsTarget.shop_name}</h5>
                <button className="btn-close" onClick={() => setPaymentsTarget(null)}/>
              </div>
              <div className="modal-body p-0">
                {loadingPayments ? (
                  <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-5"><p className="text-muted">Aucun paiement enregistré</p></div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead style={{background:'#f8f9fa'}}>
                        <tr>
                          <th className="fs-12 fw-600 border-0 ps-3">Date</th>
                          <th className="fs-12 fw-600 border-0">Période</th>
                          <th className="fs-12 fw-600 border-0">Mode</th>
                          <th className="fs-12 fw-600 border-0 text-end">Montant</th>
                          <th className="fs-12 fw-600 border-0 pe-3">Validé par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id}>
                            <td className="ps-3 align-middle fs-13">{fmtDate(p.payment_date)}</td>
                            <td className="align-middle fs-12 text-muted">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</td>
                            <td className="align-middle fs-12">{p.payment_method}</td>
                            <td className="align-middle text-end fw-600 fs-13">{fmt(p.amount)}</td>
                            <td className="align-middle pe-3 fs-12">{p.validated_by ? `${p.validated_by.firstname} ${p.validated_by.name}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setPaymentsTarget(null)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminShops;
