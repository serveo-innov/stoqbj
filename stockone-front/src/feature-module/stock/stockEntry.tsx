import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../core/services/apiService';
import { decomposeStock } from '../../core/utils/stockDecompose';
import type { DecomposableUnit } from '../../core/utils/stockDecompose';

interface ProductUnit {
  id: number;
  level: number;
  label: string;
  qty_in_parent: number;
  stock_qty: number;
  price_wholesale: string;
  product: { name: string; reference: string | null; };
  siblingUnits: DecomposableUnit[];
}

interface Supplier {
  id: number;
  name: string;
}

const StockEntry: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedUnitId = searchParams.get('unit');

  const [units,     setUnits]     = useState<ProductUnit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [justUpdatedId, setJustUpdatedId] = useState<number | null>(null);

  const [form, setForm] = useState({
    product_unit_id: '',
    quantity: '',
    supplier_id: '',
    unit_cost: '',
    reference: '',
    reason: 'Réapprovisionnement',
    moved_at: '',
  });
  const [showDateField, setShowDateField] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, suppRes] = await Promise.all([
        api.get<{ data: any[] }>('/products'),
        api.get<{ data: Supplier[] }>('/suppliers'),
      ]);
      const allUnits: ProductUnit[] = [];
      prodRes.data.forEach((p: any) => {
        p.units.forEach((u: any) => {
          allUnits.push({ ...u, product: { name: p.name, reference: p.reference }, siblingUnits: p.units });
        });
      });
      setUnits(allUnits);
      setSuppliers(suppRes.data);

      // Si on arrive depuis "Entrée stock" sur un produit précis (?unit=ID),
      // on préselectionne cette unité et on filtre la liste dessus.
      if (preselectedUnitId) {
        const match = allUnits.find(u => u.id === Number(preselectedUnitId));
        if (match) {
          setForm(f => ({ ...f, product_unit_id: preselectedUnitId }));
          setSearch(match.product.name);
        }
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const filteredUnits = units.filter(u =>
    u.product.name.toLowerCase().includes(search.toLowerCase()) ||
    u.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedUnit = units.find(u => u.id === Number(form.product_unit_id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        product_unit_id: Number(form.product_unit_id),
        quantity:        Number(form.quantity),
        reason:          form.reason,
      };
      if (form.supplier_id) payload.supplier_id = Number(form.supplier_id);
      if (form.unit_cost)   payload.unit_cost   = Number(form.unit_cost);
      if (form.reference)   payload.reference   = form.reference;
      if (form.moved_at)    payload.moved_at    = form.moved_at;

      const res = await api.post<any>('/stock/entry', payload);
      setSuccess(res.message || `Stock mis a jour : ${res.stock_before} -> ${res.stock_after} unites`);
      setJustUpdatedId(Number(form.product_unit_id));
      setTimeout(() => setJustUpdatedId(null), 4000);
      setForm(f => ({ ...f, quantity:'', supplier_id:'', unit_cost:'', reference:'', reason:'Réapprovisionnement', moved_at:'' }));
      setShowDateField(false);
      loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title d-flex align-items-center gap-2">
            <button className="btn btn-sm" onClick={() => navigate(-1)}
              style={{background:'#f3f4f6',border:'none',borderRadius:8}}>
              <i className="ti ti-arrow-left"/>
            </button>
            Entree de stock
          </h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Stock</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Entree</li>
          </ol>
        </div>
      </div>

      {success && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,color:'#16a34a'}}>
          <i className="ti ti-circle-check fs-18"/><strong>{success}</strong>
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
        {/* Formulaire */}
        <div className="col-xl-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="fw-700 mb-3 d-flex align-items-center gap-2">
                <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>
                Enregistrer une entree
              </h6>

              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Produit / Unite <span className="text-danger">*</span></label>
                    <div className="position-relative mb-2">
                      <input type="text" className="form-control" placeholder="Rechercher..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{paddingLeft:36,borderColor:'#e5e7eb',borderRadius:8}}/>
                      <i className="ti ti-search position-absolute"
                        style={{left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',fontSize:14}}/>
                    </div>
                    <select className="form-select" required
                      value={form.product_unit_id}
                      onChange={e => setForm(f=>({...f,product_unit_id:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}>
                      <option value="">Selectionner une unite...</option>
                      {filteredUnits.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.product.name} — {u.label} (Stock: {u.stock_qty})
                        </option>
                      ))}
                    </select>
                    {preselectedUnitId && search && (
                      <div className="fs-12 mt-1" style={{color:'#F97316'}}>
                        <i className="ti ti-filter me-1"/>Filtre sur ce produit —
                        <button type="button" className="btn btn-link btn-sm p-0 ms-1" style={{color:'#F97316',textDecoration:'underline'}}
                          onClick={() => setSearch('')}>voir tous les produits</button>
                      </div>
                    )}
                  </div>

                  {selectedUnit && (
                    <div className="p-3 mb-3 rounded-3 d-flex align-items-center gap-3"
                      style={{background:'#fff7ed',border:'1px solid #FED7AA'}}>
                      <div style={{
                        width:40,height:40,borderRadius:8,background:'#F97316',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        color:'#fff',fontSize:18,flexShrink:0
                      }}>
                        <i className="ti ti-package"/>
                      </div>
                      <div>
                        <div className="fw-600 fs-13">{selectedUnit.product.name}</div>
                        <div className="fs-12 text-muted">{selectedUnit.label}</div>
                        <div className="fs-12 mt-1">
                          Stock actuel : <strong style={{color:'#F97316'}}>{selectedUnit.stock_qty}</strong> unites
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Quantite <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" min="1" placeholder="0"
                      value={form.quantity} onChange={e => setForm(f=>({...f,quantity:e.target.value}))}
                      required style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>

                  {form.reason === 'Livraison fournisseur' && (
                    <div className="mb-3">
                      <label className="form-label fs-13 fw-600">Fournisseur</label>
                      <select className="form-select"
                        value={form.supplier_id}
                        onChange={e => setForm(f=>({...f,supplier_id:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}>
                        <option value="">Sans fournisseur</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="row g-2 mb-3">
                    {form.reason !== 'Retour client' && (
                      <div className="col-6">
                        <label className="form-label fs-13 fw-600">Prix unitaire (FCFA)</label>
                        <input type="number" className="form-control" min="0" placeholder="0"
                          value={form.unit_cost} onChange={e => setForm(f=>({...f,unit_cost:e.target.value}))}
                          style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                      </div>
                    )}
                    <div className={form.reason !== 'Retour client' ? 'col-6' : 'col-12'}>
                      <label className="form-label fs-13 fw-600">Ref. bon livraison</label>
                      <input type="text" className="form-control" placeholder="BL-2026-001"
                        value={form.reference} onChange={e => setForm(f=>({...f,reference:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>

                  <div className="mb-3">
                    {!showDateField ? (
                      <button type="button" className="btn btn-link btn-sm p-0" style={{color:'#F97316',textDecoration:'underline'}}
                        onClick={() => setShowDateField(true)}>
                        <i className="ti ti-calendar me-1"/>Cette entree date d'un autre jour
                      </button>
                    ) : (
                      <>
                        <label className="form-label fs-13 fw-600">Date de l'entree</label>
                        <input type="date" className="form-control" max={new Date().toISOString().slice(0,10)}
                          value={form.moved_at} onChange={e => setForm(f=>({...f,moved_at:e.target.value}))}
                          style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                      </>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="form-label fs-13 fw-600">Motif</label>
                    <select className="form-select"
                      value={form.reason}
                      onChange={e => setForm(f=>({
                        ...f,
                        reason: e.target.value,
                        supplier_id: e.target.value === 'Livraison fournisseur' ? f.supplier_id : '',
                        unit_cost: e.target.value === 'Retour client' ? '' : f.unit_cost,
                      }))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}>
                      <option>Réapprovisionnement</option>
                      <option>Livraison fournisseur</option>
                      <option>Retour client</option>
                      <option>Correction inventaire</option>
                    </select>
                  </div>

                  <button type="submit" className="btn w-100" disabled={saving}
                    style={{background:'#F97316',color:'#fff',borderRadius:8,padding:'12px',fontWeight:600,border:'none'}}>
                    {saving ? (
                      <><span className="spinner-border spinner-border-sm me-2"/>Enregistrement...</>
                    ) : (
                      <><i className="ti ti-arrow-down-circle me-2"/>Enregistrer l'entree</>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                  <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>
                  Etat des stocks
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead style={{background:'#f8f9fa'}}>
                    <tr>
                      <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                      <th className="fs-12 fw-600 border-0">Unite</th>
                      <th className="fs-12 fw-600 border-0 text-center">Stock</th>
                      <th className="fs-12 fw-600 border-0">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map(u => {
                      const isOut  = u.stock_qty <= 0;
                      const isLow  = u.stock_qty > 0 && u.stock_qty <= 5;
                      const color  = isOut ? '#dc2626' : isLow ? '#EA580C' : '#16a34a';
                      const bg     = isOut ? '#fef2f2' : isLow ? '#fff7ed' : '#f0fdf4';
                      const label  = isOut ? 'Rupture' : isLow ? 'Bas' : 'Normal';
                      const isJustUpdated = u.id === justUpdatedId;
                      return (
                        <tr key={u.id} style={{
                          cursor:'pointer',
                          transition:'background-color 0.5s ease',
                          background: isJustUpdated ? '#fff7ed' : 'transparent',
                          boxShadow: isJustUpdated ? 'inset 3px 0 0 #F97316' : 'none',
                        }}
                          onClick={() => setForm(f=>({...f,product_unit_id:String(u.id)}))}>
                          <td className="ps-3 align-middle fw-600 fs-13">{u.product.name}</td>
                          <td className="align-middle fs-13">{u.label}</td>
                          <td className="align-middle text-center">
                            <span className="fw-700 fs-14" style={{color}}>{u.stock_qty}</span>
                            {u.level === 1 && u.siblingUnits.length > 1 && (
                              <div className="fs-11 text-muted">{decomposeStock(u.stock_qty, u.siblingUnits)}</div>
                            )}
                          </td>
                          <td className="align-middle">
                            <span className="badge" style={{background:bg,color,border:`1px solid ${color}30`,fontSize:11}}>
                              {label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockEntry;