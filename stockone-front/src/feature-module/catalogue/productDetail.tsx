import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../core/services/apiService';

interface ProductUnit {
  id: number;
  level: number;
  label: string;
  qty_in_parent: number;
  stock_qty: number;
  stock_alert_threshold: number;
  price_wholesale: string;
  price_extra: string;
  cost_price: string;
  margin_percent?: number;
  is_divisible: boolean;
  is_sellable: boolean;
  last_sold_at: string | null;
}

interface Category { id: number; name: string; }

interface ProductDetail {
  id: number;
  name: string;
  reference: string | null;
  barcode: string | null;
  description: string | null;
  is_active: boolean;
  category: Category | null;
  category_id: number | null;
  units: ProductUnit[];
}

interface Movement {
  id: number;
  type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  reference: string | null;
  moved_at: string;
  user: { name: string; firstname: string };
}

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  entry:        { label:'Entrée',      color:'#16a34a', bg:'#f0fdf4' },
  sale:         { label:'Vente',       color:'#F97316', bg:'#fff7ed' },
  adjustment:   { label:'Ajustement', color:'#0891b2', bg:'#ecfeff' },
  return:       { label:'Retour',      color:'#7c3aed', bg:'#f5f3ff' },
  loss:         { label:'Perte',       color:'#dc2626', bg:'#fef2f2' },
  internal_use: { label:'Usage int.',  color:'#d97706', bg:'#fffbeb' },
  inventory:    { label:'Inventaire',  color:'#6b7280', bg:'#f3f4f6' },
};

const fmt = (n: string | number) => new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Jamais';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product,  setProduct]  = useState<ProductDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);

  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm,     setInfoForm]     = useState({ name:'', category_id:'', reference:'', barcode:'', description:'', is_active:true });
  const [savingInfo,   setSavingInfo]   = useState(false);

  const [priceTarget, setPriceTarget] = useState<ProductUnit | null>(null);
  const [priceForm,   setPriceForm]   = useState({ price_wholesale:'', price_extra:'', cost_price:'', reason:'manual', notes:'' });
  const [savingPrice, setSavingPrice] = useState(false);

  const [movementsUnit, setMovementsUnit] = useState<ProductUnit | null>(null);
  const [movements,      setMovements]      = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get<{ data: ProductDetail }>(`/products/${id}`),
        api.get<{ data: Category[] }>('/categories'),
      ]);
      setProduct(prodRes.data);
      setCategories(catRes.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openEditInfo = () => {
    if (!product) return;
    setInfoForm({
      name: product.name, category_id: product.category_id ? String(product.category_id) : '',
      reference: product.reference || '', barcode: product.barcode || '',
      description: product.description || '', is_active: product.is_active,
    });
    setEditingInfo(true);
    setError(null);
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSavingInfo(true);
    setError(null);
    try {
      await api.put(`/products/${product.id}`, {
        name: infoForm.name,
        category_id: infoForm.category_id ? Number(infoForm.category_id) : null,
        reference: infoForm.reference || null,
        barcode: infoForm.barcode || null,
        description: infoForm.description || null,
        is_active: infoForm.is_active,
      });
      setSuccess('Produit modifié.');
      setEditingInfo(false);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSavingInfo(false); }
  };

  const openPriceEdit = (unit: ProductUnit) => {
    setPriceTarget(unit);
    setPriceForm({
      price_wholesale: unit.price_wholesale, price_extra: unit.price_extra,
      cost_price: unit.cost_price, reason:'manual', notes:'',
    });
    setError(null);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !priceTarget) return;
    setSavingPrice(true);
    setError(null);
    try {
      await api.put(`/products/${product.id}/units/${priceTarget.id}/price`, {
        price_wholesale: Number(priceForm.price_wholesale),
        price_extra: Number(priceForm.price_extra),
        cost_price: Number(priceForm.cost_price),
        reason: priceForm.reason,
        notes: priceForm.notes || undefined,
      });
      setSuccess('Prix mis à jour.');
      setPriceTarget(null);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSavingPrice(false); }
  };

  const openMovements = async (unit: ProductUnit) => {
    setMovementsUnit(unit);
    setLoadingMovements(true);
    try {
      const res = await api.get<any>('/stock/movements', { product_unit_id: unit.id });
      setMovements(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingMovements(false); }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>;
  }

  if (error && !product) {
    return (
      <div className="alert" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
        <i className="ti ti-alert-circle me-2"/>{error}
      </div>
    );
  }

  if (!product) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title d-flex align-items-center gap-2">
            <button className="btn btn-sm" onClick={() => navigate(-1)}
              style={{background:'#f3f4f6',border:'none',borderRadius:8}}>
              <i className="ti ti-arrow-left"/>
            </button>
            {product.name}
            {!product.is_active && (
              <span className="badge" style={{background:'#f3f4f6',color:'#6b7280',fontSize:11}}>Archivé</span>
            )}
          </h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Catalogue</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>{product.name}</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2" onClick={openEditInfo}
          style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>
          <i className="ti ti-edit fs-16"/>Modifier
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

      {/* Infos produit */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <div className="fs-11 text-muted">Catégorie</div>
              <div className="fs-13 fw-600">{product.category?.name || 'Sans catégorie'}</div>
            </div>
            <div className="col-md-3">
              <div className="fs-11 text-muted">Référence</div>
              <div className="fs-13 fw-600">{product.reference || '—'}</div>
            </div>
            <div className="col-md-3">
              <div className="fs-11 text-muted">Code-barres</div>
              <div className="fs-13 fw-600">{product.barcode || '—'}</div>
            </div>
            <div className="col-md-3">
              <div className="fs-11 text-muted">Nb unités</div>
              <div className="fs-13 fw-600">{product.units.length}</div>
            </div>
          </div>
          {product.description && (
            <div className="mt-3 pt-3" style={{borderTop:'1px solid #f3f4f6'}}>
              <div className="fs-11 text-muted mb-1">Description</div>
              <div className="fs-13">{product.description}</div>
            </div>
          )}
        </div>
      </div>

      {/* Unités */}
      <h6 className="fw-700 mb-2 text-muted fs-13" style={{textTransform:'uppercase',letterSpacing:0.5}}>Unités de vente</h6>
      <div className="row g-3 mb-4">
        {product.units.sort((a,b) => a.level - b.level).map(unit => {
          const isOut = unit.stock_qty <= 0;
          const isLow = unit.stock_qty > 0 && unit.stock_qty <= unit.stock_alert_threshold;
          const stockColor = isOut ? '#dc2626' : isLow ? '#EA580C' : '#16a34a';
          return (
            <div className="col-md-6 col-xl-4" key={unit.id}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span className="badge mb-1" style={{background:'#fff7ed',color:'#F97316',fontSize:10}}>Niveau {unit.level}</span>
                      <div className="fw-700 fs-14">{unit.label}</div>
                    </div>
                    <span className="badge" style={{background:`${stockColor}15`,color:stockColor,fontSize:11}}>
                      {unit.stock_qty} en stock
                    </span>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <div className="fs-11 text-muted">Prix gros</div>
                      <div className="fs-13 fw-600">{fmt(unit.price_wholesale)}</div>
                    </div>
                    <div className="col-6">
                      <div className="fs-11 text-muted">Prix extra</div>
                      <div className="fs-13 fw-600">{fmt(unit.price_extra)}</div>
                    </div>
                    <div className="col-6">
                      <div className="fs-11 text-muted">Prix achat</div>
                      <div className="fs-13">{fmt(unit.cost_price)}</div>
                    </div>
                    <div className="col-6">
                      <div className="fs-11 text-muted">Marge</div>
                      <div className="fs-13" style={{color:'#16a34a'}}>
                        {unit.margin_percent !== undefined ? `${unit.margin_percent}%` : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="fs-11 text-muted mb-2">Dernière vente : {fmtDate(unit.last_sold_at)}</div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-sm flex-fill" onClick={() => openPriceEdit(unit)}
                      style={{background:'#fff7ed',color:'#F97316',border:'none',borderRadius:6,fontSize:12}}>
                      <i className="ti ti-currency-franc me-1"/>Prix
                    </button>
                    <button className="btn btn-sm flex-fill" onClick={() => openMovements(unit)}
                      style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:12}}>
                      <i className="ti ti-arrows-exchange me-1"/>Mouvements
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal édition infos */}
      {editingInfo && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-edit me-2" style={{color:'#F97316'}}/>Modifier le produit</h5>
                <button className="btn-close" onClick={() => setEditingInfo(false)}/>
              </div>
              <form onSubmit={handleSaveInfo}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Nom <span className="text-danger">*</span></label>
                    <input className="form-control" required value={infoForm.name}
                      onChange={e => setInfoForm(f=>({...f,name:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Catégorie</label>
                    <select className="form-select" value={infoForm.category_id}
                      onChange={e => setInfoForm(f=>({...f,category_id:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                      <option value="">Sans catégorie</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Référence</label>
                      <input className="form-control" value={infoForm.reference}
                        onChange={e => setInfoForm(f=>({...f,reference:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Code-barres</label>
                      <input className="form-control" value={infoForm.barcode}
                        onChange={e => setInfoForm(f=>({...f,barcode:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Description</label>
                    <textarea className="form-control" rows={3} value={infoForm.description}
                      onChange={e => setInfoForm(f=>({...f,description:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" id="isActive"
                      checked={infoForm.is_active} onChange={e => setInfoForm(f=>({...f,is_active:e.target.checked}))}/>
                    <label className="form-check-label fs-13" htmlFor="isActive">Produit actif</label>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setEditingInfo(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={savingInfo}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {savingInfo ? <span className="spinner-border spinner-border-sm"/> : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition prix */}
      {priceTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-currency-franc me-2" style={{color:'#F97316'}}/>Prix — {priceTarget.label}</h5>
                <button className="btn-close" onClick={() => setPriceTarget(null)}/>
              </div>
              <form onSubmit={handleSavePrice}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Prix gros</label>
                      <input type="number" className="form-control" min={0} value={priceForm.price_wholesale}
                        onChange={e => setPriceForm(f=>({...f,price_wholesale:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Prix extra</label>
                      <input type="number" className="form-control" min={0} value={priceForm.price_extra}
                        onChange={e => setPriceForm(f=>({...f,price_extra:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Prix d'achat</label>
                    <input type="number" className="form-control" min={0} value={priceForm.cost_price}
                      onChange={e => setPriceForm(f=>({...f,cost_price:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Raison</label>
                    <select className="form-select" value={priceForm.reason}
                      onChange={e => setPriceForm(f=>({...f,reason:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                      <option value="manual">Manuel</option>
                      <option value="promotion">Promotion</option>
                      <option value="correction">Correction</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Notes</label>
                    <textarea className="form-control" rows={2} value={priceForm.notes}
                      onChange={e => setPriceForm(f=>({...f,notes:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setPriceTarget(null)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={savingPrice}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {savingPrice ? <span className="spinner-border spinner-border-sm"/> : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal mouvements */}
      {movementsUnit && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-arrows-exchange me-2" style={{color:'#F97316'}}/>Mouvements — {movementsUnit.label}</h5>
                <button className="btn-close" onClick={() => setMovementsUnit(null)}/>
              </div>
              <div className="modal-body p-0">
                {loadingMovements ? (
                  <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
                ) : movements.length === 0 ? (
                  <div className="text-center py-5"><p className="text-muted">Aucun mouvement enregistré</p></div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead style={{background:'#f8f9fa'}}>
                        <tr>
                          <th className="fs-12 fw-600 border-0 ps-3">Date</th>
                          <th className="fs-12 fw-600 border-0">Type</th>
                          <th className="fs-12 fw-600 border-0 text-center">Qté</th>
                          <th className="fs-12 fw-600 border-0 text-center">Avant → Après</th>
                          <th className="fs-12 fw-600 border-0 pe-3">Utilisateur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map(m => {
                          const cfg = typeConfig[m.type] || { label:m.type, color:'#6b7280', bg:'#f3f4f6' };
                          return (
                            <tr key={m.id}>
                              <td className="ps-3 align-middle fs-12 text-muted">{fmtDate(m.moved_at)}</td>
                              <td className="align-middle">
                                <span className="badge" style={{background:cfg.bg,color:cfg.color,fontSize:11}}>{cfg.label}</span>
                              </td>
                              <td className="align-middle text-center fw-700" style={{color: m.quantity > 0 ? '#16a34a' : '#dc2626'}}>
                                {m.quantity > 0 ? '+' : ''}{m.quantity}
                              </td>
                              <td className="align-middle text-center fs-13 text-muted">{m.stock_before} → {m.stock_after}</td>
                              <td className="align-middle pe-3 fs-12">{m.user?.firstname} {m.user?.name}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setMovementsUnit(null)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
