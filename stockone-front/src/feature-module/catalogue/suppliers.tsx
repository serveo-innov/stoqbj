import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  is_active: boolean;
}

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'', city:'Cotonou', notes:'' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: Supplier[] }>('/suppliers');
      setSuppliers(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/suppliers', form);
      setSuccess('Fournisseur créé !');
      setShowModal(false);
      setForm({ name:'', phone:'', email:'', address:'', city:'Cotonou', notes:'' });
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.city || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Fournisseurs</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Catalogue</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Fournisseurs</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2"
          style={{background:'#F97316',color:'#fff',borderRadius:8,padding:'8px 16px',fontWeight:600}}
          onClick={() => setShowModal(true)}>
          <i className="ti ti-plus fs-16"/>Nouveau fournisseur
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

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row align-items-center g-2">
            <div className="col-md-6">
              <div className="position-relative">
                <input type="text" className="form-control" placeholder="Rechercher un fournisseur..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{paddingLeft:40,borderColor:'#e5e7eb',borderRadius:8}}/>
                <i className="ti ti-search position-absolute"
                  style={{left:12,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}/>
              </div>
            </div>
            <div className="col-md-6 d-flex justify-content-md-end">
              <span className="fs-13 text-muted">
                <span className="fw-600" style={{color:'#F97316'}}>{filtered.length}</span> fournisseur{filtered.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="ti ti-truck d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">Aucun fournisseur</p>
              <button className="btn btn-sm mt-2"
                style={{background:'#F97316',color:'#fff',borderRadius:8}}
                onClick={() => setShowModal(true)}>
                <i className="ti ti-plus me-1"/>Ajouter un fournisseur
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Fournisseur</th>
                    <th className="fs-12 fw-600 border-0">Téléphone</th>
                    <th className="fs-12 fw-600 border-0">Email</th>
                    <th className="fs-12 fw-600 border-0">Ville</th>
                    <th className="fs-12 fw-600 border-0">Statut</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td className="ps-3 align-middle">
                        <div className="d-flex align-items-center gap-2">
                          <div style={{
                            width:36, height:36, borderRadius:8,
                            background:'#fff7ed',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'#F97316', fontSize:16, flexShrink:0
                          }}>
                            <i className="ti ti-building"/>
                          </div>
                          <span className="fw-600 fs-13">{s.name}</span>
                        </div>
                      </td>
                      <td className="align-middle fs-13">{s.phone || '—'}</td>
                      <td className="align-middle fs-13">{s.email || '—'}</td>
                      <td className="align-middle fs-13">{s.city || '—'}</td>
                      <td className="align-middle">
                        <span className="badge" style={{
                          background: s.is_active ? '#f0fdf4' : '#f3f4f6',
                          color: s.is_active ? '#16a34a' : '#6b7280', fontSize:11
                        }}>
                          {s.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="align-middle text-end pe-3">
                        <button className="btn btn-sm"
                          style={{background:'#f3f4f6',border:'none',borderRadius:6,padding:'4px 8px'}}>
                          <i className="ti ti-edit" style={{color:'#1a1a1a'}}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-truck me-2" style={{color:'#F97316'}}/>Nouveau fournisseur
                </h5>
                <button className="btn-close" onClick={() => setShowModal(false)}/>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3"
                      style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fs-13 fw-600">Nom <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" placeholder="Editions Hachette Bénin"
                        value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fs-13 fw-600">Téléphone</label>
                      <input type="tel" className="form-control" placeholder="+229 97 00 00 00"
                        value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))}/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fs-13 fw-600">Email</label>
                      <input type="email" className="form-control" placeholder="contact@fournisseur.bj"
                        value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))}/>
                    </div>
                    <div className="col-md-8">
                      <label className="form-label fs-13 fw-600">Adresse</label>
                      <input type="text" className="form-control" placeholder="Rue du Commerce"
                        value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))}/>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fs-13 fw-600">Ville</label>
                      <input type="text" className="form-control"
                        value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))}/>
                    </div>
                    <div className="col-12">
                      <label className="form-label fs-13 fw-600">Notes</label>
                      <textarea className="form-control" rows={2} placeholder="Remarques..."
                        value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}/>
                    </div>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4"
                    style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                    onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={saving}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1"/>...</> : <><i className="ti ti-check me-1"/>Créer</>}
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

export default Suppliers;
