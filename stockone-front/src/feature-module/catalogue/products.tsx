import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';

interface ProductUnit {
  id: number;
  level: number;
  label: string;
  price_wholesale: string;
  price_extra: string;
  cost_price: string;
  stock_qty: number;
  stock_alert_threshold: number;
  is_sellable: boolean;
}

interface Product {
  id: number;
  name: string;
  reference: string | null;
  barcode: string | null;
  is_active: boolean;
  category: { id: number; name: string; color: string } | null;
  units: ProductUnit[];
}

const fmt = (n: string | number) =>
  new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';

const Products: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [showModal,setShowModal]= useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', reference: '', barcode: '', description: '', category_id: '',
    units: [
      { level: 1, label: 'Unité', qty_in_parent: 1, price_wholesale: '', price_extra: '', cost_price: '', stock_qty: 0, stock_alert_threshold: 5, is_divisible: false, is_sellable: true }
    ]
  });
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => { loadProducts(); loadCategories(); }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: Product[] }>('/products');
      setProducts(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get<{ data: any[] }>('/categories');
      setCategories(res.data);
    } catch (_) {}
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference || '').toLowerCase().includes(search.toLowerCase())
  );

  const addUnit = () => {
    const nextLevel = form.units.length + 1;
    if (nextLevel > 3) return;
    setForm(f => ({
      ...f,
      units: [...f.units, {
        level: nextLevel, label: nextLevel === 2 ? 'Boîte' : 'Carton',
        qty_in_parent: 10, price_wholesale: '', price_extra: '', cost_price: '',
        stock_qty: 0, stock_alert_threshold: 2, is_divisible: true, is_sellable: true
      }]
    }));
  };

  const removeUnit = (idx: number) => {
    setForm(f => ({ ...f, units: f.units.filter((_, i) => i !== idx) }));
  };

  const updateUnit = (idx: number, field: string, value: any) => {
    setForm(f => ({
      ...f,
      units: f.units.map((u, i) => i === idx ? { ...u, [field]: value } : u)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/products', {
        name:        form.name,
        reference:   form.reference   || undefined,
        barcode:     form.barcode     || undefined,
        description: form.description || undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        units: form.units.map(u => ({
          ...u,
          price_wholesale: Number(u.price_wholesale),
          price_extra:     Number(u.price_extra),
          cost_price:      Number(u.cost_price),
        }))
      });
      setSuccess('Produit créé avec succès !');
      setShowModal(false);
      setForm({
        name:'', reference:'', barcode:'', description:'', category_id:'',
        units:[{ level:1, label:'Unité', qty_in_parent:1, price_wholesale:'', price_extra:'', cost_price:'', stock_qty:0, stock_alert_threshold:5, is_divisible:false, is_sellable:true }]
      });
      loadProducts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message || 'Erreur lors de la création'); }
    finally { setSaving(false); }
  };

  const getStockStatus = (unit: ProductUnit) => {
    if (unit.stock_qty <= 0) return { label:'Rupture', color:'#dc2626', bg:'#fef2f2' };
    if (unit.stock_qty <= unit.stock_alert_threshold) return { label:'Bas', color:'#EA580C', bg:'#fff7ed' };
    return { label:'Normal', color:'#16a34a', bg:'#f0fdf4' };
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Produits</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Catalogue</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Produits</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2"
          style={{background:'#F97316',color:'#fff',borderRadius:8,padding:'8px 16px',fontWeight:600}}
          onClick={() => setShowModal(true)}>
          <i className="ti ti-plus fs-16"/>Nouveau produit
        </button>
      </div>

      {success && (
        <div className="alert d-flex align-items-center gap-2 mb-3"
          style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,color:'#16a34a'}}>
          <i className="ti ti-circle-check"/>{success}
        </div>
      )}
      {error && (
        <div className="alert d-flex align-items-center gap-2 mb-3"
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
                <input type="text" className="form-control" placeholder="Rechercher un produit, référence..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{paddingLeft:40,borderColor:'#e5e7eb',borderRadius:8}}/>
                <i className="ti ti-search position-absolute" style={{left:12,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}/>
              </div>
            </div>
            <div className="col-md-6 d-flex align-items-center justify-content-md-end gap-3">
              <span className="fs-13 text-muted">
                <span className="fw-600" style={{color:'#F97316'}}>{filtered.length}</span> produit{filtered.length > 1 ? 's' : ''}
              </span>
              <button className="btn btn-sm" style={{background:'#f3f4f6',borderRadius:6,border:'none'}} onClick={loadProducts}>
                <i className="ti ti-refresh me-1"/>Actualiser
              </button>
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
              <i className="ti ti-package d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted fs-14">{search ? 'Aucun produit trouvé' : 'Aucun produit créé'}</p>
              {!search && (
                <button className="btn btn-sm mt-2"
                  style={{background:'#F97316',color:'#fff',borderRadius:8}}
                  onClick={() => setShowModal(true)}>
                  <i className="ti ti-plus me-1"/>Créer le premier produit
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                    <th className="fs-12 fw-600 border-0">Catégorie</th>
                    <th className="fs-12 fw-600 border-0">Unité</th>
                    <th className="fs-12 fw-600 border-0">Stock</th>
                    <th className="fs-12 fw-600 border-0">Prix Gros</th>
                    <th className="fs-12 fw-600 border-0">Prix Extra</th>
                    <th className="fs-12 fw-600 border-0">Statut</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(product =>
                    product.units.map((unit, ui) => (
                      <tr key={`${product.id}-${unit.id}`}>
                        {ui === 0 && (
                          <td className="ps-3 align-middle" rowSpan={product.units.length} style={{cursor:'pointer'}}
                            onClick={() => navigate(all_routes.productDetail.replace(':id', String(product.id)))}>
                            <div className="fw-600 fs-13">{product.name}</div>
                            {product.reference && <div className="fs-11 text-muted">Réf: {product.reference}</div>}
                          </td>
                        )}
                        {ui === 0 && (
                          <td className="align-middle" rowSpan={product.units.length}>
                            {product.category ? (
                              <span className="badge" style={{background:`${product.category.color}20`,color:product.category.color,border:`1px solid ${product.category.color}40`,fontSize:11}}>
                                {product.category.name}
                              </span>
                            ) : <span className="text-muted fs-12">—</span>}
                          </td>
                        )}
                        <td className="align-middle">
                          <div className="d-flex align-items-center gap-1">
                            <span style={{width:18,height:18,borderRadius:'50%',background:unit.level===1?'#1a1a1a':unit.level===2?'#F97316':'#EA580C',color:'#fff',fontSize:9,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                              {unit.level}
                            </span>
                            <span className="fs-13">{unit.label}</span>
                          </div>
                        </td>
                        <td className="align-middle fw-600 fs-13">{unit.stock_qty}</td>
                        <td className="align-middle fs-13">{fmt(unit.price_wholesale)}</td>
                        <td className="align-middle fs-13">{fmt(unit.price_extra)}</td>
                        <td className="align-middle">
                          {(() => { const s = getStockStatus(unit); return (
                            <span className="badge" style={{background:s.bg,color:s.color,border:`1px solid ${s.color}30`,fontSize:11}}>{s.label}</span>
                          );})()}
                        </td>
                        {ui === 0 && (
                          <td className="align-middle text-end pe-3" rowSpan={product.units.length}>
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              <Link to={`${all_routes.stockEntry}?unit=${product.units[0]?.id}`}
                                className="btn btn-sm" title="Entrée stock"
                                style={{background:'#f3f4f6',border:'none',borderRadius:6,padding:'4px 8px'}}>
                                <i className="ti ti-arrow-down-circle" style={{color:'#F97316'}}/>
                              </Link>
                              <button className="btn btn-sm" title="Voir / Modifier"
                                onClick={() => navigate(all_routes.productDetail.replace(':id', String(product.id)))}
                                style={{background:'#f3f4f6',border:'none',borderRadius:6,padding:'4px 8px'}}>
                                <i className="ti ti-edit" style={{color:'#1a1a1a'}}/>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-package me-2" style={{color:'#F97316'}}/>Nouveau produit
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
                  <div className="p-3 mb-3 rounded-3" style={{background:'#f8f9fa'}}>
                    <h6 className="fw-600 mb-3 fs-13" style={{color:'#F97316'}}>Informations produit</h6>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fs-13 fw-600">Nom <span className="text-danger">*</span></label>
                        <input type="text" className="form-control" placeholder="ex: Stylo Bic Cristal Bleu"
                          value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required/>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fs-13 fw-600">Catégorie</label>
                        <select className="form-select" value={form.category_id} onChange={e => setForm(f=>({...f,category_id:e.target.value}))}>
                          <option value="">Sans catégorie</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fs-13 fw-600">Référence</label>
                        <input type="text" className="form-control" placeholder="REF-001"
                          value={form.reference} onChange={e => setForm(f=>({...f,reference:e.target.value}))}/>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fs-13 fw-600">Code-barres</label>
                        <input type="text" className="form-control" placeholder="123456789"
                          value={form.barcode} onChange={e => setForm(f=>({...f,barcode:e.target.value}))}/>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-3" style={{background:'#fff7ed',border:'1px solid #FED7AA'}}>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="fw-600 mb-0 fs-13" style={{color:'#EA580C'}}>
                        Unités de conditionnement ({form.units.length}/3)
                      </h6>
                      {form.units.length < 3 && (
                        <button type="button" className="btn btn-sm"
                          style={{background:'#F97316',color:'#fff',borderRadius:6,fontSize:12}}
                          onClick={addUnit}>
                          <i className="ti ti-plus me-1"/>Ajouter niveau
                        </button>
                      )}
                    </div>
                    {form.units.map((unit, idx) => (
                      <div key={idx} className="card mb-3 border-0"
                        style={{borderLeft:`3px solid ${idx===0?'#1a1a1a':idx===1?'#F97316':'#EA580C'}`,borderRadius:8}}>
                        <div className="card-body p-3">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="fw-600 fs-13">
                              Niveau {unit.level} {idx===0?'(Unité de base)':idx===1?'(Intermédiaire)':'(Gros)'}
                            </span>
                            {idx > 0 && (
                              <button type="button" className="btn btn-sm text-danger p-0" onClick={() => removeUnit(idx)}>
                                <i className="ti ti-trash"/>
                              </button>
                            )}
                          </div>
                          <div className="row g-2">
                            <div className="col-md-4">
                              <label className="form-label fs-12 fw-600">Label <span className="text-danger">*</span></label>
                              <input type="text" className="form-control form-control-sm" placeholder="ex: Pièce"
                                value={unit.label} onChange={e => updateUnit(idx,'label',e.target.value)} required/>
                            </div>
                            {idx > 0 && (
                              <div className="col-md-4">
                                <label className="form-label fs-12 fw-600">Qté dans parent <span className="text-danger">*</span></label>
                                <input type="number" className="form-control form-control-sm" min="1"
                                  value={unit.qty_in_parent} onChange={e => updateUnit(idx,'qty_in_parent',Number(e.target.value))} required/>
                              </div>
                            )}
                            <div className="col-md-4">
                              <label className="form-label fs-12 fw-600">Stock initial</label>
                              <input type="number" className="form-control form-control-sm" min="0"
                                value={unit.stock_qty} onChange={e => updateUnit(idx,'stock_qty',Number(e.target.value))}/>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label fs-12 fw-600">Prix Gros <span className="text-danger">*</span></label>
                              <input type="number" className="form-control form-control-sm" min="0" placeholder="0"
                                value={unit.price_wholesale} onChange={e => updateUnit(idx,'price_wholesale',e.target.value)} required/>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label fs-12 fw-600">Prix Extra <span className="text-danger">*</span></label>
                              <input type="number" className="form-control form-control-sm" min="0" placeholder="0"
                                value={unit.price_extra} onChange={e => updateUnit(idx,'price_extra',e.target.value)} required/>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label fs-12 fw-600">Prix achat <span className="text-danger">*</span></label>
                              <input type="number" className="form-control form-control-sm" min="0" placeholder="0"
                                value={unit.cost_price} onChange={e => updateUnit(idx,'cost_price',e.target.value)} required/>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label fs-12 fw-600">Seuil alerte</label>
                              <input type="number" className="form-control form-control-sm" min="0"
                                value={unit.stock_alert_threshold} onChange={e => updateUnit(idx,'stock_alert_threshold',Number(e.target.value))}/>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4"
                    style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                    onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={saving}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1"/>Enregistrement...</> : <><i className="ti ti-check me-1"/>Créer le produit</>}
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

export default Products;
