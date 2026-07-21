import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';

interface ShopSettings {
  id: number;
  shop_name: string;
  commercial_name: string | null;
  owner_name: string;
  owner_firstname: string;
  owner_email: string;
  owner_phone: string;
  owner_phone_secondary: string | null;
  address: string;
  city: string;
  neighborhood: string | null;
  ifu_number: string | null;
  rccm_number: string | null;
  brand_color: string | null;
  slogan: string | null;
  default_credit_days: number;
  status: string;
  subscription_end: string | null;
}

const emptyForm = {
  commercial_name:'', owner_phone:'', owner_phone_secondary:'',
  address:'', city:'', neighborhood:'', ifu_number:'', rccm_number:'',
  brand_color:'#F97316', slogan:'', default_credit_days:'30',
};

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  trial:     { label:'Période d\'essai', color:'#d97706', bg:'#fffbeb' },
  active:    { label:'Active',           color:'#16a34a', bg:'#f0fdf4' },
  suspended: { label:'Suspendue',        color:'#dc2626', bg:'#fef2f2' },
  closed:    { label:'Fermée',           color:'#6b7280', bg:'#f3f4f6' },
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const Settings: React.FC = () => {
  const [shop,    setShop]    = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: ShopSettings }>('/settings');
      setShop(res.data);
      setForm({
        commercial_name: res.data.commercial_name || '',
        owner_phone: res.data.owner_phone || '',
        owner_phone_secondary: res.data.owner_phone_secondary || '',
        address: res.data.address || '',
        city: res.data.city || '',
        neighborhood: res.data.neighborhood || '',
        ifu_number: res.data.ifu_number || '',
        rccm_number: res.data.rccm_number || '',
        brand_color: res.data.brand_color || '#F97316',
        slogan: res.data.slogan || '',
        default_credit_days: String(res.data.default_credit_days || 30),
      });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = { ...form, default_credit_days: Number(form.default_credit_days) };
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
      await api.put('/settings', payload);
      setSuccess('Paramètres enregistrés.');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>;
  }

  if (error && !shop) {
    return (
      <div className="alert" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
        <i className="ti ti-alert-circle me-2"/>{error}
      </div>
    );
  }

  if (!shop) return null;
  const st = statusLabels[shop.status] || { label:shop.status, color:'#6b7280', bg:'#f3f4f6' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Paramètres de la boutique</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Boutique</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Paramètres</li>
          </ol>
        </div>
        <span className="badge" style={{background:st.bg,color:st.color,border:`1px solid ${st.color}30`,fontSize:12,padding:'6px 12px'}}>
          {st.label}
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
        {/* Infos non modifiables */}
        <div className="col-xl-4">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h6 className="fw-700 mb-3 fs-13">Informations légales</h6>
              <div className="mb-2">
                <div className="fs-11 text-muted">Nom légal</div>
                <div className="fs-13 fw-600">{shop.shop_name}</div>
              </div>
              <div className="mb-2">
                <div className="fs-11 text-muted">Propriétaire</div>
                <div className="fs-13 fw-600">{shop.owner_firstname} {shop.owner_name}</div>
              </div>
              <div className="mb-2">
                <div className="fs-11 text-muted">Email</div>
                <div className="fs-13">{shop.owner_email}</div>
              </div>
              <p className="fs-11 text-muted mt-3 mb-0">
                <i className="ti ti-lock me-1"/>Ces informations ne sont modifiables que par le Super Admin.
              </p>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="fw-700 mb-3 fs-13">Abonnement</h6>
              <div className="mb-2">
                <div className="fs-11 text-muted">Statut</div>
                <span className="badge" style={{background:st.bg,color:st.color,fontSize:11}}>{st.label}</span>
              </div>
              <div>
                <div className="fs-11 text-muted">Expire le</div>
                <div className="fs-13 fw-600">{fmtDate(shop.subscription_end)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Formulaire éditable */}
        <div className="col-xl-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="fw-700 mb-3 fs-13">Identité commerciale</h6>
              <form onSubmit={handleSubmit}>
                <div className="row g-2 mb-3">
                  <div className="col-md-8">
                    <label className="form-label fs-13 fw-600">Nom commercial</label>
                    <input className="form-control" value={form.commercial_name}
                      onChange={e => setForm(f=>({...f,commercial_name:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fs-13 fw-600">Couleur de marque</label>
                    <input type="color" className="form-control form-control-color w-100" value={form.brand_color}
                      onChange={e => setForm(f=>({...f,brand_color:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fs-13 fw-600">Slogan</label>
                  <input className="form-control" placeholder="Votre partenaire papeterie de confiance"
                    value={form.slogan} onChange={e => setForm(f=>({...f,slogan:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                </div>

                <h6 className="fw-700 mb-3 fs-13 pt-2" style={{borderTop:'1px solid #f3f4f6'}}>Contact</h6>
                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">Téléphone principal</label>
                    <input className="form-control" value={form.owner_phone}
                      onChange={e => setForm(f=>({...f,owner_phone:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">Téléphone secondaire</label>
                    <input className="form-control" value={form.owner_phone_secondary}
                      onChange={e => setForm(f=>({...f,owner_phone_secondary:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fs-13 fw-600">Adresse</label>
                  <input className="form-control" value={form.address}
                    onChange={e => setForm(f=>({...f,address:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">Ville</label>
                    <input className="form-control" value={form.city}
                      onChange={e => setForm(f=>({...f,city:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">Quartier</label>
                    <input className="form-control" value={form.neighborhood}
                      onChange={e => setForm(f=>({...f,neighborhood:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>

                <h6 className="fw-700 mb-3 fs-13 pt-2" style={{borderTop:'1px solid #f3f4f6'}}>Administratif</h6>
                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">N° IFU</label>
                    <input className="form-control" value={form.ifu_number}
                      onChange={e => setForm(f=>({...f,ifu_number:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">N° RCCM</label>
                    <input className="form-control" value={form.rccm_number}
                      onChange={e => setForm(f=>({...f,rccm_number:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>

                <h6 className="fw-700 mb-3 fs-13 pt-2" style={{borderTop:'1px solid #f3f4f6'}}>Crédits clients</h6>
                <div className="mb-3">
                  <label className="form-label fs-13 fw-600">Délai de crédit par défaut (jours)</label>
                  <input type="number" className="form-control" min={1} max={365} style={{maxWidth:150,borderColor:'#e5e7eb',borderRadius:8}}
                    value={form.default_credit_days} onChange={e => setForm(f=>({...f,default_credit_days:e.target.value}))}/>
                  <div className="fs-11 text-muted mt-1">Utilisé comme valeur par défaut lors de la création d'un crédit client.</div>
                </div>

                <button type="submit" className="btn" disabled={saving}
                  style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:600}}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-2"/>Enregistrement...</> : <><i className="ti ti-check me-2"/>Enregistrer</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
