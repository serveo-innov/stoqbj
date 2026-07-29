import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  is_active: boolean;
  products_count: number;
}

const ICON_OPTIONS = [
  'ti-book', 'ti-notebook', 'ti-pencil', 'ti-ballpen', 'ti-eraser',
  'ti-ruler', 'ti-scissors', 'ti-paint', 'ti-palette', 'ti-folder',
  'ti-briefcase', 'ti-box', 'ti-package', 'ti-tag', 'ti-category',
];

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', color: '#F97316', icon: 'ti-category' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: Category[] }>('/categories');
      setCategories(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ name: '', color: '#F97316', icon: 'ti-category' });
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, color: cat.color, icon: cat.icon || 'ti-category' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, form);
        setSuccess('Categorie modifiee !');
      } else {
        await api.post('/categories', form);
        setSuccess('Categorie creee !');
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', color: '#F97316', icon: 'ti-category' });
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.errors?.name?.[0] || e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (cat: Category) => {
    try {
      await api.put(`/categories/${cat.id}`, { is_active: !cat.is_active });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (cat: Category) => {
    if (cat.products_count > 0) return;
    if (!window.confirm(`Supprimer definitivement la categorie "${cat.name}" ?`)) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      setSuccess('Categorie supprimee.');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
  };

  const colors = ['#F97316','#EA580C','#1a1a1a','#16a34a','#0891b2','#7c3aed','#dc2626','#d97706'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Categories</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Catalogue</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Categories</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2"
          style={{background:'#F97316',color:'#fff',borderRadius:8,padding:'8px 16px',fontWeight:600}}
          onClick={openCreateModal}>
          <i className="ti ti-plus fs-16"/>Nouvelle categorie
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

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
        </div>
      ) : (
        <div className="row g-3">
          {categories.length === 0 ? (
            <div className="col-12 text-center py-5">
              <i className="ti ti-category d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">Aucune categorie creee</p>
              <button className="btn btn-sm mt-2"
                style={{background:'#F97316',color:'#fff',borderRadius:8}}
                onClick={openCreateModal}>
                <i className="ti ti-plus me-1"/>Creer une categorie
              </button>
            </div>
          ) : categories.map(cat => (
            <div key={cat.id} className="col-xl-3 col-md-4 col-sm-6">
              <div className="card border-0 shadow-sm h-100"
                style={{borderRadius:10, opacity:cat.is_active ? 1 : 0.6}}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{
                      width:44, height:44, borderRadius:10,
                      background:`${cat.color}20`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:cat.color, fontSize:20
                    }}>
                      <i className={`ti ${cat.icon || 'ti-category'}`}/>
                    </div>
                    <div className="dropdown">
                      <button className="btn btn-sm p-1" data-bs-toggle="dropdown"
                        style={{background:'#f3f4f6',border:'none',borderRadius:6}}>
                        <i className="ti ti-dots-vertical fs-14"/>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        <li>
                          <button className="dropdown-item fs-13" onClick={() => openEditModal(cat)}>
                            <i className="ti ti-edit me-2"/>Modifier
                          </button>
                        </li>
                        <li>
                          <button className="dropdown-item fs-13" onClick={() => toggleActive(cat)}>
                            <i className={`ti ${cat.is_active?'ti-eye-off':'ti-eye'} me-2`}/>
                            {cat.is_active ? 'Desactiver' : 'Activer'}
                          </button>
                        </li>
                        <li>
                          <button
                            className="dropdown-item fs-13 text-danger"
                            disabled={cat.products_count > 0}
                            title={cat.products_count > 0 ? `Desactivez plutot cette categorie, elle contient encore ${cat.products_count} produit(s)` : ''}
                            onClick={() => handleDelete(cat)}
                            style={cat.products_count > 0 ? {opacity:0.4,cursor:'not-allowed'} : {}}
                          >
                            <i className="ti ti-trash me-2"/>Supprimer
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <h6 className="fw-700 mb-1">{cat.name}</h6>
                  <p className="text-muted fs-12 mb-2">
                    {cat.products_count} produit{cat.products_count > 1 ? 's' : ''}
                  </p>
                  <div className="d-flex align-items-center justify-content-between">
                    <div style={{width:24,height:24,borderRadius:'50%',background:cat.color}}/>
                    <span className="badge" style={{
                      background: cat.is_active ? '#f0fdf4' : '#f3f4f6',
                      color: cat.is_active ? '#16a34a' : '#6b7280', fontSize:11
                    }}>
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-category me-2" style={{color:'#F97316'}}/>
                  {editingId ? 'Modifier la categorie' : 'Nouvelle categorie'}
                </h5>
                <button className="btn-close" onClick={() => setShowModal(false)}/>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Nom <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" placeholder="ex: Cahiers & Bloc-notes"
                      value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required/>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Couleur</label>
                    <div className="d-flex gap-2 flex-wrap mt-1">
                      {colors.map(c => (
                        <button key={c} type="button" style={{
                          width:32, height:32, borderRadius:'50%', background:c, border:'none',
                          outline: form.color===c ? `3px solid ${c}` : 'none',
                          outlineOffset:2, cursor:'pointer'
                        }} onClick={() => setForm(f=>({...f,color:c}))}/>
                      ))}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Icone</label>
                    <div className="d-flex gap-2 flex-wrap mt-1">
                      {ICON_OPTIONS.map(ic => (
                        <button key={ic} type="button"
                          onClick={() => setForm(f=>({...f,icon:ic}))}
                          style={{
                            width:40, height:40, borderRadius:8,
                            background: form.icon===ic ? `${form.color}20` : '#f8f9fa',
                            border: form.icon===ic ? `2px solid ${form.color}` : '1px solid #e5e7eb',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color: form.icon===ic ? form.color : '#6b7280', fontSize:18, cursor:'pointer'
                          }}
                        >
                          <i className={`ti ${ic}`}/>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded-3 d-flex align-items-center gap-3"
                    style={{background:'#f8f9fa',border:'1px solid #e5e7eb'}}>
                    <div style={{
                      width:44, height:44, borderRadius:10,
                      background:`${form.color}20`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:form.color, fontSize:20
                    }}>
                      <i className={`ti ${form.icon}`}/>
                    </div>
                    <div>
                      <div className="fw-600 fs-14">{form.name || 'Apercu de la categorie'}</div>
                      <div className="fs-12 text-muted">Apercu</div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4"
                    style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                    onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={saving}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1"/>...</> : <><i className="ti ti-check me-1"/>{editingId ? 'Enregistrer' : 'Creer'}</>}
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

export default Categories;