import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';

interface ProductUnit {
  id: number;
  level: number;
  label: string;
  stock_qty: number;
  price_wholesale: string;
  product: { name: string; reference: string | null; };
}

interface Supplier {
  id: number;
  name: string;
}

const StockEntry: React.FC = () => {
  const [units,     setUnits]     = useState<ProductUnit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [search,    setSearch]    = useState('');

  const [form, setForm] = useState({
    product_unit_id: '',
    quantity: '',
    supplier_id: '',
    unit_cost: '',
    reference: '',
    reason: 'Réapprovisionnement',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, suppRes] = await Promise.all([
        api.get<{ data: any[] }>('/products'),
        api.get<{ data: Supplier[] }>('/suppliers'),
      ]);
      // Extraire toutes les unités avec info produit
      const allUnits: ProductUnit[] = [];
      prodRes.data.forEach((p: any) => {
        p.units.forEach((u: any) => {
          allUnits.push({ ...u, product: { name: p.name, reference: p.reference } });
        });
      });
      setUnits(allUnits);
      setSuppliers(suppRes.data);
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

      const res = await api.post<any>('/stock/entry', payload);
      setSuccess(`Stock mis à jour : ${res.stock_before} → ${res.stock_after} unités`);
      setForm({ product_unit_id:'', quantity:'', supplier_id:'', unit_cost:'', reference:'', reason:'Réapprovisionnement' });
      loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Entrée de stock</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Stock</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Entrée</li>
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
                Enregistrer une entrée
              </h6>

              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {/* Sélection produit */}
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Produit / Unité <span className="text-danger">*</span></label>
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
                      <option value="">Sélectionner une unité...</option>
                      {filteredUnits.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.product.name} — {u.label} (Stock: {u.stock_qty})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Info unité sélectionnée */}
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
                          Stock actuel : <strong style={{color:'#F97316'}}>{selectedUnit.stock_qty}</strong> unités
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quantité */}
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Quantité <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" min="1" placeholder="0"
                      value={form.quantity} onChange={e => setForm(f=>({...f,quantity:e.target.value}))}
                      required style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>

                  {/* Fournisseur */}
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

                  {/* Prix d'achat & référence */}
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Prix unitaire (FCFA)</label>
                      <input type="number" className="form-control" min="0" placeholder="0"
                        value={form.unit_cost} onChange={e => setForm(f=>({...f,unit_cost:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Réf. bon livraison</label>
                      <input type="text" className="form-control" placeholder="BL-2026-001"
                        value={form.reference} onChange={e => setForm(f=>({...f,reference:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>

                  {/* Raison */}
                  <div className="mb-4">
                    <label className="form-label fs-13 fw-600">Motif</label>
                    <select className="form-select"
                      value={form.reason}
                      onChange={e => setForm(f=>({...f,reason:e.target.value}))}
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
                      <><i className="ti ti-arrow-down-circle me-2"/>Enregistrer l'entrée</>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Liste des produits avec stock */}
        <div className="col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                  <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>
                  État des stocks
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead style={{background:'#f8f9fa'}}>
                    <tr>
                      <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                      <th className="fs-12 fw-600 border-0">Unité</th>
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
                      return (
                        <tr key={u.id} style={{cursor:'pointer'}}
                          onClick={() => setForm(f=>({...f,product_unit_id:String(u.id)}))}>
                          <td className="ps-3 align-middle fw-600 fs-13">{u.product.name}</td>
                          <td className="align-middle fs-13">{u.label}</td>
                          <td className="align-middle text-center">
                            <span className="fw-700 fs-14" style={{color}}>{u.stock_qty}</span>
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
