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
  price_detail: string;
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
  entry:        { label:'EntrÃ©e',      color:'#16a34a', bg:'#f0fdf4' },
  sale:         { label:'Vente',       color:'#F97316', bg:'#fff7ed' },
  adjustment:   { label:'Ajustement', color:'#0891b2', bg:'#ecfeff' },
  return:       { label:'Retour',      color:'#7c3aed', bg:'#f5f3ff' },
  loss:         { label:'Perte',       color:'#dc2626', bg:'#fef2f2' },
  internal_use: { label:'Usage int.',  color:'#d97706', bg:'#fffbeb' },
  inventory:    { label:'Inventaire',  color:'#6b7280', bg:'#f3f4f6' },
};

const levelName = (level: number) => level === 1 ? '(Unite de base)' : level === 2 ? '(Intermediaire)' : '(Gros)';

const fmt = (n: string | number) => new Intl.NumberFormat('fr-FR').format(Number(n)) + ' F';
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Jamais';

const emptyUnitForm = {
  label: '', qty_in_parent: 1, price_wholesale: '', price_extra: '', cost_price: '',
  stock_alert_threshold: 5, is_divisible: true, is_sellable: true,
};

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
  const [priceForm,   setPriceForm]   = useState({ price_wholesale:'', price_detail:'', price_extra:'', cost_price:'', reason:'manual', notes:'' });
  const [savingPrice, setSavingPrice] = useState(false);

  const [movementsUnit, setMovementsUnit] = useState<ProductUnit | null>(null);
  const [movements,      setMovements]      = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Gestion des niveaux (ajout / modification / suppression)
  const [unitModal,   setUnitModal]   = useState<'add' | 'edit' | null>(null);
  const [unitTarget,  setUnitTarget]  = useState<ProductUnit | null>(null);
  const [unitForm,    setUnitForm]    = useState(emptyUnitForm);
  const [savingUnit,  setSavingUnit]  = useState(false);

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
      setSuccess('Produit modifiÃ©.');
      setEditingInfo(false);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSavingInfo(false); }
  };

  const openPriceEdit = (unit: ProductUnit) => {
    setPriceTarget(unit);
    setPriceForm({
      price_wholesale: unit.price_wholesale, price_detail: unit.price_detail, price_extra: unit.price_extra,
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
        price_detail: Number(priceForm.price_detail),
        price_extra: Number(priceForm.price_extra),
        cost_price: Number(priceForm.cost_price),
        reason: priceForm.reason,
        notes: priceForm.notes || undefined,
      });
      setSuccess('Prix mis Ã  jour.');
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

  // â”€â”€ Gestion des niveaux â”€â”€

  const openAddUnit = () => {
    setUnitForm(emptyUnitForm);
    setUnitModal('add');
    setError(null);
  };

  const openEditUnit = (unit: ProductUnit) => {
    setUnitTarget(unit);
    setUnitForm({
      label: unit.label,
      qty_in_parent: unit.qty_in_parent,
      price_wholesale: '', price_extra: '', cost_price: '',
      stock_alert_threshold: unit.stock_alert_threshold,
      is_divisible: unit.is_divisible,
      is_sellable: unit.is_sellable,
    });
    setUnitModal('edit');
    setError(null);
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSavingUnit(true);
    setError(null);
    try {
      const nextLevel = product.units.length + 1;
      await api.post(`/products/${product.id}/units`, {
        level: nextLevel,
        label: unitForm.label,
        qty_in_parent: unitForm.qty_in_parent,
        price_wholesale: Number(unitForm.price_wholesale),
        price_extra: Number(unitForm.price_extra),
        cost_price: Number(unitForm.cost_price),
        stock_alert_threshold: unitForm.stock_alert_threshold,
        is_divisible: unitForm.is_divisible,
        is_sellable: unitForm.is_sellable,
      });
      setSuccess('Niveau ajoutÃ©.');
      setUnitModal(null);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSavingUnit(false); }
  };

  const handleEditUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !unitTarget) return;
    setSavingUnit(true);
    setError(null);
    try {
      await api.put(`/products/${product.id}/units/${unitTarget.id}`, {
        label: unitForm.label,
        qty_in_parent: unitForm.qty_in_parent,
        stock_alert_threshold: unitForm.stock_alert_threshold,
        is_divisible: unitForm.is_divisible,
        is_sellable: unitForm.is_sellable,
      });
      setSuccess('Niveau modifiÃ©.');
      setUnitModal(null);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSavingUnit(false); }
  };

  const handleDeleteUnit = async (unit: ProductUnit) => {
    if (!product) return;
    if (!window.confirm(`Supprimer definitivement le niveau "${unit.label}" ?`)) return;
    setError(null);
    try {
      await api.delete(`/products/${product.id}/units/${unit.id}`);
      setSuccess('Niveau supprimÃ©.');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      // 409 (historique existant) ou 422 (niveau intermediaire avec enfant) :
      // le message du backend est deja clair, on l'affiche tel quel.
      setError(e.message);
    }
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

  const canAddUnit = product.units.length < 3;

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
              <span className="badge" style={{background:'#f3f4f6',color:'#6b7280',fontSize:11}}>ArchivÃ©</span>
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
              <div className="fs-11 text-muted">CatÃ©gorie</div>
              <div className="fs-13 fw-600">{product.category?.name || 'Sans catÃ©gorie'}</div>
            </div>
            <div className="col-md-3">
              <div className="fs-11 text-muted">RÃ©fÃ©rence</div>
              <div className="fs-13 fw-600">{product.reference || 'â€”'}</div>
            </div>
            <div className="col-md-3">
              <div className="fs-11 text-muted">Code-barres</div>
              <div className="fs-13 fw-600">{product.barcode || 'â€”'}</div>
            </div>
            <div className="col-md-3">
              <div className="fs-11 text-muted">Nb unitÃ©s</div>
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

      {/* UnitÃ©s */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="fw-700 mb-0 text-muted fs-13" style={{textTransform:'uppercase',letterSpacing:0.5}}>
          UnitÃ©s de vente ({product.units.length}/3)
        </h6>
        {canAddUnit && (
          <button className="btn btn-sm" onClick={openAddUnit}
            style={{background:'#F97316',color:'#fff',border:'none',borderRadius:6,fontSize:12,padding:'4px 10px'}}>
            <i className="ti ti-plus me-1"/>Ajouter niveau
          </button>
        )}
      </div>
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
                      <span className="badge mb-1" style={{background:'#fff7ed',color:'#F97316',fontSize:10}}>
                        Niveau {unit.level} {levelName(unit.level)}
                      </span>
                      <div className="fw-700 fs-14">{unit.label}</div>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <span className="badge" style={{background:`${stockColor}15`,color:stockColor,fontSize:11}}>
                        {unit.stock_qty} en stock
                      </span>
                      <div className="dropdown">
                        <button className="btn btn-sm p-1" data-bs-toggle="dropdown"
                          style={{background:'#f3f4f6',border:'none',borderRadius:6}}>
                          <i className="ti ti-dots-vertical fs-14"/>
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li>
                            <button className="dropdown-item fs-13" onClick={() => openEditUnit(unit)}>
                              <i className="ti ti-edit me-2"/>Modifier le niveau
                            </button>
                          </li>
                          {unit.level > 1 && (
                            <li>
                              <button className="dropdown-item fs-13 text-danger" onClick={() => handleDeleteUnit(unit)}>
                                <i className="ti ti-trash me-2"/>Supprimer le niveau
                              </button>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {unit.level > 1 && (
                    <div className="fs-11 text-muted mb-2">
                      1 {unit.label} = {unit.qty_in_parent} unitÃ©(s) du niveau {unit.level - 1}
                    </div>
                  )}

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <div className="fs-11 text-muted">Prix gros</div>
                      <div className="fs-13 fw-600">{fmt(unit.price_wholesale)}</div>
                    </div>
                    <div className="col-6">
                      <div className="fs-11 text-muted">Prix detail</div>
                      <div className="fs-13 fw-600">{fmt(unit.price_detail)}</div>
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
                        {unit.margin_percent !== undefined ? `${unit.margin_percent}%` : 'â€”'}
                      </div>
                    </div>
                  </div>

                  <div className="fs-11 text-muted mb-2">DerniÃ¨re vente : {fmtDate(unit.last_sold_at)}</div>

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

      {/* Modal Ã©dition infos */}
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
                    <label className="form-label fs-13 fw-600">CatÃ©gorie</label>
                    <select className="form-select" value={infoForm.category_id}
                      onChange={e => setInfoForm(f=>({...f,category_id:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                      <option value="">Sans catÃ©gorie</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">RÃ©fÃ©rence</label>
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

      {/* Modal Ã©dition prix */}
      {priceTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-currency-franc me-2" style={{color:'#F97316'}}/>Prix â€” {priceTarget.label}</h5>
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
                      <label className="form-label fs-13 fw-600">Prix detail</label>
                      <input type="number" className="form-control" min={0} value={priceForm.price_detail}
                        onChange={e => setPriceForm(f=>({...f,price_detail:e.target.value}))} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
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

      {/* Modal ajout / edition niveau */}
      {unitModal && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-stack-2 me-2" style={{color:'#F97316'}}/>
                  {unitModal === 'add' ? `Ajouter le niveau ${product.units.length + 1}` : `Modifier â€” ${unitTarget?.label}`}
                </h5>
                <button className="btn-close" onClick={() => setUnitModal(null)}/>
              </div>
              <form onSubmit={unitModal === 'add' ? handleAddUnit : handleEditUnit}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label fs-13 fw-600">Label <span className="text-danger">*</span></label>
                      <input className="form-control" required placeholder="ex: Boite, Carton"
                        value={unitForm.label} onChange={e => setUnitForm(f=>({...f,label:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fs-13 fw-600">Qte dans le niveau du dessous <span className="text-danger">*</span></label>
                      <input type="number" className="form-control" min={1} required
                        value={unitForm.qty_in_parent} onChange={e => setUnitForm(f=>({...f,qty_in_parent:Number(e.target.value)}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>

                  {unitModal === 'add' && (
                    <div className="row g-2 mb-2">
                      <div className="col-md-4">
                        <label className="form-label fs-13 fw-600">Prix gros <span className="text-danger">*</span></label>
                        <input type="number" className="form-control" min={0} required
                          value={unitForm.price_wholesale} onChange={e => setUnitForm(f=>({...f,price_wholesale:e.target.value}))}
                          style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fs-13 fw-600">Prix extra <span className="text-danger">*</span></label>
                        <input type="number" className="form-control" min={0} required
                          value={unitForm.price_extra} onChange={e => setUnitForm(f=>({...f,price_extra:e.target.value}))}
                          style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fs-13 fw-600">Prix achat <span className="text-danger">*</span></label>
                        <input type="number" className="form-control" min={0} required
                          value={unitForm.cost_price} onChange={e => setUnitForm(f=>({...f,cost_price:e.target.value}))}
                          style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                      </div>
                    </div>
                  )}

                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Seuil alerte</label>
                    <input type="number" className="form-control" min={0}
                      value={unitForm.stock_alert_threshold} onChange={e => setUnitForm(f=>({...f,stock_alert_threshold:Number(e.target.value)}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>

                  <div className="form-check form-switch mb-1">
                    <input className="form-check-input" type="checkbox" id="isSellable"
                      checked={unitForm.is_sellable} onChange={e => setUnitForm(f=>({...f,is_sellable:e.target.checked}))}/>
                    <label className="form-check-label fs-13" htmlFor="isSellable">Vendable</label>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setUnitModal(null)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={savingUnit}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {savingUnit ? <span className="spinner-border spinner-border-sm"/> : 'Enregistrer'}
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
                <h5 className="modal-title fw-700"><i className="ti ti-arrows-exchange me-2" style={{color:'#F97316'}}/>Mouvements â€” {movementsUnit.label}</h5>
                <button className="btn-close" onClick={() => setMovementsUnit(null)}/>
              </div>
              <div className="modal-body p-0">
                {loadingMovements ? (
                  <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
                ) : movements.length === 0 ? (
                  <div className="text-center py-5"><p className="text-muted">Aucun mouvement enregistrÃ©</p></div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead style={{background:'#f8f9fa'}}>
                        <tr>
                          <th className="fs-12 fw-600 border-0 ps-3">Date</th>
                          <th className="fs-12 fw-600 border-0">Type</th>
                          <th className="fs-12 fw-600 border-0 text-center">QtÃ©</th>
                          <th className="fs-12 fw-600 border-0 text-center">Avant â†’ AprÃ¨s</th>
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
                              <td className="align-middle text-center fs-13 text-muted">{m.stock_before} â†’ {m.stock_after}</td>
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