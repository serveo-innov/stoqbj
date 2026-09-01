import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';

interface ProductUnit {
  id: number;
  level: number;
  label: string;
  stock_qty: number;
}

interface Product {
  id: number;
  name: string;
  reference: string | null;
  category: { id: number; name: string } | null;
  units: ProductUnit[];
}

interface Category { id: number; name: string; }

interface CountRow {
  product_unit_id: number;
  product_name: string;
  unit_label: string;
  theoretical: number;
  counted: string; // string pour permettre un champ vide tant que non saisi
}

interface AdjustmentResult {
  product_unit_id: number;
  product_name: string;
  unit_label: string;
  delta: number;
  status: 'success' | 'error';
  message?: string;
}

const todayStr = () => new Date().toLocaleDateString('fr-FR');

const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
  const lines = [headers.map(esc).join(';')].concat(rows.map(r => r.map(esc).join(';')));
  const csv = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const Inventory: React.FC = () => {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const [rows,   setRows]   = useState<CountRow[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [hideUnchanged,  setHideUnchanged]  = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [results,    setResults]    = useState<AdjustmentResult[] | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get<{ data: Product[] }>('/products'),
        api.get<{ data: Category[] }>('/categories'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      const initialRows: CountRow[] = [];
      prodRes.data.forEach(p => {
        p.units.forEach(u => {
          initialRows.push({
            product_unit_id: u.id,
            product_name: p.name,
            unit_label: u.label,
            theoretical: u.stock_qty,
            counted: '',
          });
        });
      });
      setRows(initialRows);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const updateCounted = (unitId: number, value: string) => {
    setRows(prev => prev.map(r => r.product_unit_id === unitId ? { ...r, counted: value } : r));
  };

  const filteredRows = rows.filter(r => {
    if (search && !`${r.product_name} ${r.unit_label}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter) {
      const product = products.find(p => p.units.some(u => u.id === r.product_unit_id));
      if (product?.category?.id !== Number(categoryFilter)) return false;
    }
    if (hideUnchanged) {
      const hasCount = r.counted !== '';
      const delta = hasCount ? Number(r.counted) - r.theoretical : 0;
      if (!hasCount || delta === 0) return false;
    }
    return true;
  });

  const rowsToSubmit = rows.filter(r => r.counted !== '' && Number(r.counted) !== r.theoretical);
  const nbCounted = rows.filter(r => r.counted !== '').length;
  const nbDiscrepancies = rowsToSubmit.length;

  const handleSubmitClick = () => {
    if (rowsToSubmit.length === 0) { setError('Aucun écart à corriger — rien à soumettre.'); return; }
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);
    setShowConfirm(false);
    setError(null);
    const outcomes: AdjustmentResult[] = [];

    for (const row of rowsToSubmit) {
      const delta = Number(row.counted) - row.theoretical;
      try {
        await api.post('/stock/adjustment', {
          product_unit_id: row.product_unit_id,
          quantity: delta,
          type: 'inventory',
          reason: `Inventaire physique du ${todayStr()}`,
        });
        outcomes.push({
          product_unit_id: row.product_unit_id, product_name: row.product_name,
          unit_label: row.unit_label, delta, status: 'success',
        });
      } catch (e: any) {
        outcomes.push({
          product_unit_id: row.product_unit_id, product_name: row.product_name,
          unit_label: row.unit_label, delta, status: 'error', message: e.message,
        });
      }
    }

    setResults(outcomes);
    setSubmitting(false);
    load(); // recharge les stocks théoriques à jour
  };

  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Inventaire physique</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Stock</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Inventaire</li>
          </ol>
        </div>
        <div className="d-flex gap-3 align-items-center">
          <div className="text-end">
            <div className="fs-11 text-muted">Comptés</div>
            <div className="fw-700 fs-14">{nbCounted}/{rows.length}</div>
          </div>
          <div className="text-end">
            <div className="fs-11 text-muted">Écarts</div>
            <div className="fw-700 fs-14" style={{color: nbDiscrepancies > 0 ? '#dc2626' : '#16a34a'}}>{nbDiscrepancies}</div>
          </div>
          <button className="btn d-flex align-items-center gap-2"
            style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}
            onClick={() => downloadCsv(
              'Feuille_comptage_' + todayStr().replace(/\//g,'-') + '.csv',
              ['Produit', 'Unite', 'Stock theorique', 'Stock compte', 'Ecart'],
              rows.map(function(r) {
                return [r.product_name, r.unit_label, r.theoretical, r.counted || '', r.counted !== '' ? Number(r.counted) - r.theoretical : ''];
              })
            )}>
            <i className="ti ti-download fs-16"/>Exporter (CSV)
          </button>
          <button className="btn d-flex align-items-center gap-2" disabled={submitting} onClick={handleSubmitClick}
            style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>
            {submitting ? <span className="spinner-border spinner-border-sm"/> : <><i className="ti ti-check fs-16"/>Valider l'inventaire</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
          <button className="btn-close ms-auto" onClick={() => setError(null)}/>
        </div>
      )}

      {/* Résultats après soumission */}
      {results && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-700 mb-3 d-flex align-items-center gap-2">
              <i className="ti ti-clipboard-check" style={{color:'#F97316'}}/>
              Résultat de l'inventaire ({results.filter(r=>r.status==='success').length}/{results.length} ajustements appliqués)
            </h6>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-11 fw-600 border-0">Produit</th>
                    <th className="fs-11 fw-600 border-0 text-center">Écart appliqué</th>
                    <th className="fs-11 fw-600 border-0">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={idx}>
                      <td className="fs-13">{r.product_name} — {r.unit_label}</td>
                      <td className="text-center fw-600 fs-13" style={{color: r.delta > 0 ? '#16a34a' : '#dc2626'}}>{fmt(r.delta)}</td>
                      <td>
                        {r.status === 'success' ? (
                          <span className="badge" style={{background:'#f0fdf4',color:'#16a34a',fontSize:11}}>Appliqué</span>
                        ) : (
                          <span className="badge" style={{background:'#fef2f2',color:'#dc2626',fontSize:11}} title={r.message}>Échec</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-sm" onClick={() => downloadCsv(
                'Resultat_inventaire_' + todayStr().replace(/\//g,'-') + '.csv',
                ['Produit', 'Unite', 'Ecart applique', 'Statut'],
                results!.map(function(r) {
                  return [r.product_name, r.unit_label, r.delta, r.status === 'success' ? 'Applique' : 'Echec: ' + (r.message || '')];
                })
              )}
                style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8}}>
                <i className="ti ti-download me-1"/>Exporter (CSV)
              </button>
              <button className="btn btn-sm" onClick={() => setResults(null)}
                style={{background:'#f3f4f6',border:'none',borderRadius:8}}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label fs-12 fw-600">Recherche</label>
              <input type="text" className="form-control form-control-sm" placeholder="Nom du produit..."
                value={search} onChange={e => setSearch(e.target.value)} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
            </div>
            <div className="col-md-4">
              <label className="form-label fs-12 fw-600">Catégorie</label>
              <select className="form-select form-select-sm" value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)} style={{borderColor:'#e5e7eb',borderRadius:8}}>
                <option value="">Toutes</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="hideUnchanged"
                  checked={hideUnchanged} onChange={e => setHideUnchanged(e.target.checked)}/>
                <label className="form-check-label fs-13" htmlFor="hideUnchanged">Écarts uniquement</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau de comptage */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {filteredRows.length === 0 ? (
            <div className="text-center py-5">
              <i className="ti ti-clipboard-list d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">Aucun produit à afficher</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                    <th className="fs-12 fw-600 border-0">Unité</th>
                    <th className="fs-12 fw-600 border-0 text-center">Stock théorique</th>
                    <th className="fs-12 fw-600 border-0 text-center">Stock compté</th>
                    <th className="fs-12 fw-600 border-0 text-center pe-3">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => {
                    const hasCount = row.counted !== '';
                    const delta = hasCount ? Number(row.counted) - row.theoretical : null;
                    return (
                      <tr key={row.product_unit_id}>
                        <td className="ps-3 align-middle fw-600 fs-13">{row.product_name}</td>
                        <td className="align-middle fs-13">{row.unit_label}</td>
                        <td className="align-middle text-center fs-13 text-muted">{row.theoretical}</td>
                        <td className="align-middle text-center">
                          <input type="number" min={0}
                            placeholder="—"
                            value={row.counted}
                            onChange={e => updateCounted(row.product_unit_id, e.target.value)}
                            style={{
                              width: 80, textAlign:'center', padding:'4px 6px',
                              borderRadius: 6, border: '1px solid #e5e7eb',
                              background: hasCount && delta !== 0 ? '#fff7ed' : '#fff',
                            }}/>
                        </td>
                        <td className="align-middle text-center pe-3">
                          {hasCount ? (
                            <span className="fw-700 fs-13" style={{color: delta === 0 ? '#16a34a' : delta! > 0 ? '#16a34a' : '#dc2626'}}>
                              {fmt(delta!)}
                            </span>
                          ) : (
                            <span className="fs-12 text-muted">—</span>
                          )}
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

      {/* Modal confirmation */}
      {showConfirm && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700"><i className="ti ti-clipboard-check me-2" style={{color:'#F97316'}}/>Valider l'inventaire</h5>
                <button className="btn-close" onClick={() => setShowConfirm(false)}/>
              </div>
              <div className="modal-body">
                <p className="fs-14">
                  Vous vous apprêtez à appliquer <strong>{nbDiscrepancies} ajustement{nbDiscrepancies > 1 ? 's' : ''}</strong> de stock
                  basés sur votre comptage physique. Cette action est irréversible (mais chaque ajustement reste tracé dans l'historique des mouvements).
                </p>
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4" style={{background:'#f3f4f6',border:'none',borderRadius:8}} onClick={() => setShowConfirm(false)}>Annuler</button>
                <button className="btn btn-sm px-4" onClick={confirmSubmit}
                  style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                  Confirmer et appliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
