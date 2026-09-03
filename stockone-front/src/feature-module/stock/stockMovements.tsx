import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../core/services/apiService';

interface Movement {
  id: number;
  type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  reference: string | null;
  inventory_id: number | null;
  moved_at: string;
  product_unit: { label: string; product: { name: string } };
  user: { name: string; firstname: string };
  supplier: { name: string } | null;
}

const typeConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  entry:        { label:'Entrée',      color:'#16a34a', bg:'#f0fdf4', icon:'ti-arrow-down-circle' },
  sale:         { label:'Vente',       color:'#F97316', bg:'#fff7ed', icon:'ti-shopping-cart' },
  adjustment:   { label:'Ajustement', color:'#0891b2', bg:'#ecfeff', icon:'ti-adjustments' },
  return:       { label:'Retour',      color:'#7c3aed', bg:'#f5f3ff', icon:'ti-arrow-back' },
  loss:         { label:'Perte',       color:'#dc2626', bg:'#fef2f2', icon:'ti-trash' },
  internal_use: { label:'Usage int.',  color:'#d97706', bg:'#fffbeb', icon:'ti-tool' },
  inventory:    { label:'Inventaire',  color:'#6b7280', bg:'#f3f4f6', icon:'ti-clipboard' },
};

const StockMovements: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedInventoryId = searchParams.get('inventory_id');

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [filters,   setFilters]   = useState({ type:'', from:'', to:'', inventory_id: preselectedInventoryId || '' });

  useEffect(() => { load(); }, []);

  const load = async (overrideFilters?: typeof filters) => {
    const f = overrideFilters ?? filters;
    try {
      setLoading(true);
      const params: any = {};
      if (f.type)         params.type = f.type;
      if (f.from)         params.from = f.from;
      if (f.to)            params.to = f.to;
      if (f.inventory_id)  params.inventory_id = f.inventory_id;
      const res = await api.get<any>('/stock/movements', params);
      setMovements(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const clearInventoryFilter = () => {
    const next = { ...filters, inventory_id: '' };
    setFilters(next);
    searchParams.delete('inventory_id');
    setSearchParams(searchParams);
    load(next);
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Mouvements de stock</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Stock</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Mouvements</li>
          </ol>
        </div>
      </div>

      {preselectedInventoryId && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fff7ed',border:'1px solid #FED7AA',borderRadius:8,color:'#EA580C'}}>
          <i className="ti ti-filter"/>
          Filtré sur la session d'inventaire #{preselectedInventoryId}
          <button className="btn btn-link btn-sm p-0 ms-auto" style={{color:'#F97316',textDecoration:'underline'}}
            onClick={clearInventoryFilter}>
            Voir tous les mouvements
          </button>
        </div>
      )}

      {error && (
        <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle me-2"/>{error}
        </div>
      )}

      {/* Filtres */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Type</label>
              <select className="form-select form-select-sm"
                value={filters.type} onChange={e => setFilters(f=>({...f,type:e.target.value}))}
                style={{borderColor:'#e5e7eb',borderRadius:8}}>
                <option value="">Tous les types</option>
                {Object.entries(typeConfig).map(([k,v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Du</label>
              <input type="date" className="form-select form-select-sm"
                value={filters.from} onChange={e => setFilters(f=>({...f,from:e.target.value}))}
                style={{borderColor:'#e5e7eb',borderRadius:8}}/>
            </div>
            <div className="col-md-3">
              <label className="form-label fs-12 fw-600">Au</label>
              <input type="date" className="form-select form-select-sm"
                value={filters.to} onChange={e => setFilters(f=>({...f,to:e.target.value}))}
                style={{borderColor:'#e5e7eb',borderRadius:8}}/>
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-sm flex-1"
                style={{background:'#F97316',color:'#fff',borderRadius:8,border:'none',flex:1}}
                onClick={() => load()}>
                <i className="ti ti-search me-1"/>Filtrer
              </button>
              <button className="btn btn-sm"
                style={{background:'#f3f4f6',borderRadius:8,border:'none'}}
                onClick={() => { const next = {type:'',from:'',to:'',inventory_id:''}; setFilters(next); searchParams.delete('inventory_id'); setSearchParams(searchParams); load(next); }}>
                <i className="ti ti-x"/>
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
          ) : movements.length === 0 ? (
            <div className="text-center py-5">
              <i className="ti ti-arrows-exchange d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">Aucun mouvement trouvé</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Date</th>
                    <th className="fs-12 fw-600 border-0">Produit</th>
                    <th className="fs-12 fw-600 border-0">Type</th>
                    <th className="fs-12 fw-600 border-0 text-center">Qté</th>
                    <th className="fs-12 fw-600 border-0 text-center">Avant</th>
                    <th className="fs-12 fw-600 border-0 text-center">Après</th>
                    <th className="fs-12 fw-600 border-0">Utilisateur</th>
                    <th className="fs-12 fw-600 border-0">Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => {
                    const cfg = typeConfig[m.type] || { label:m.type, color:'#6b7280', bg:'#f3f4f6', icon:'ti-circle' };
                    return (
                      <tr key={m.id}>
                        <td className="ps-3 align-middle fs-12 text-muted">{fmt(m.moved_at)}</td>
                        <td className="align-middle">
                          <div className="fw-600 fs-13">{m.product_unit?.product?.name}</div>
                          <div className="fs-11 text-muted">{m.product_unit?.label}</div>
                        </td>
                        <td className="align-middle">
                          <span className="badge d-flex align-items-center gap-1" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,fontSize:11,width:'fit-content'}}>
                            <i className={`ti ${cfg.icon}`}/>{cfg.label}
                          </span>
                          {m.inventory_id && (
                            <div className="fs-10 text-muted mt-1">Inventaire #{m.inventory_id}</div>
                          )}
                        </td>
                        <td className="align-middle text-center">
                          <span className="fw-700" style={{color: m.quantity > 0 ? '#16a34a' : '#dc2626'}}>
                            {m.quantity > 0 ? '+' : ''}{m.quantity}
                          </span>
                        </td>
                        <td className="align-middle text-center fs-13 text-muted">{m.stock_before}</td>
                        <td className="align-middle text-center fs-13 fw-600">{m.stock_after}</td>
                        <td className="align-middle fs-12">{m.user?.firstname} {m.user?.name}</td>
                        <td className="align-middle fs-12 text-muted">{m.reason || m.reference || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockMovements;
