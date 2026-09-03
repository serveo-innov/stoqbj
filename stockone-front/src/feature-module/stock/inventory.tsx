import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../core/services/apiService';
import { API_BASE_URL } from '../../environment';
import { all_routes } from '../router/all_routes';

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
  level: number;
  editable: boolean;
  theoretical: number;
  counted: string;
}

interface AdjustmentResult {
  product_unit_id: number;
  product_name: string;
  unit_label: string;
  delta: number;
  status: 'match' | 'success' | 'error';
  message?: string;
}

interface HistoryRow {
  id: number;
  created_at: string;
  created_by: string;
  items_count: number;
  discrepancies: number;
  notes: string | null;
}

const todayStr = () => new Date().toLocaleDateString('fr-FR');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

const getToken = (): string | null => localStorage.getItem('stockone_token');
const getShopId = (): number | null => {
  const user = JSON.parse(localStorage.getItem('stockone_user') || 'null');
  return user?.role === 'super_admin' ? null : user?.shop?.id ?? null;
};

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

const downloadInventoryPdf = async (id: number): Promise<void> => {
  const url = new URL(`${API_BASE_URL}/inventory/${id}/pdf`);
  const shopId = getShopId();
  if (shopId) url.searchParams.set('shop_id', String(shopId));
  const token = getToken();

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/pdf', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || `Erreur ${response.status}`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const match = disposition && disposition.match(/filename="?(.+)"?/);
  const filename = match ? match[1].replace(/"/g, '') : `inventaire-${id}.pdf`;

  const link = document.createElement('a');
  const objectUrl = window.URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};

const Inventory: React.FC = () => {
  const navigate = useNavigate();

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
  const [inventoryId, setInventoryId] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [showHistory,   setShowHistory]   = useState(false);
  const [history,       setHistory]       = useState<HistoryRow[]>([]);
  const [loadingHistory,setLoadingHistory] = useState(false);
  const [historyError,  setHistoryError]  = useState<string | null>(null);

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
            level: u.level,
            editable: u.level === 1,
            theoretical: u.stock_qty,
            counted: '',
          });
        });
      });
      setRows(initialRows);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      setHistoryError(null);
      const res = await api.get<{ data: HistoryRow[] }>('/inventory/history');
      setHistory(res.data || []);
    } catch (e: any) {
      setHistoryError(e.message || "Erreur lors du chargement de l'historique.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) loadHistory();
  };

  const updateCounted = (unitId: number, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setRows(prev => prev.map(r => r.product_unit_id === unitId ? { ...r, counted: cleaned } : r));
  };

  const filteredRows = rows.filter(r => {
    if (search && !`${r.product_name} ${r.unit_label}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter) {
      const product = products.find(p => p.units.some(u => u.id === r.product_unit_id));
      if (product?.category?.id !== Number(categoryFilter)) return false;
    }
    if (hideUnchanged) {
      if (!r.editable) return false;
      const hasCount = r.counted !== '';
      const delta = hasCount ? Number(r.counted) - r.theoretical : 0;
      if (!hasCount || delta === 0) return false;
    }
    return true;
  });

  const editableRows = rows.filter(r => r.editable);
  const countedRows = editableRows.filter(r => r.counted !== '');
  const rowsWithGap = countedRows.filter(r => Number(r.counted) !== r.theoretical);
  const nbCounted = countedRows.length;
  const nbDiscrepancies = rowsWithGap.length;

  const handleSubmitClick = () => {
    if (countedRows.length === 0) { setError('Aucun produit compté — rien à soumettre.'); return; }
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);
    setShowConfirm(false);
    setError(null);
    try {
      const res = await api.post<{ inventory_id: number; results: AdjustmentResult[] }>('/inventory', {
        notes: `Inventaire physique du ${todayStr()}`,
        items: countedRows.map(r => ({
          product_unit_id: r.product_unit_id,
          theoretical_qty: r.theoretical,
          physical_qty: Number(r.counted),
        })),
      });
      setResults(res.results);
      setInventoryId(res.inventory_id);
      load();
      if (showHistory) loadHistory();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la validation de l'inventaire.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async (id: number) => {
    setDownloadingPdf(id);
    setError(null);
    try {
      await downloadInventoryPdf(id);
    } catch (e: any) {
      setError(e.message || "Erreur lors du téléchargement du PDF.");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const goToMovements = (h: HistoryRow) => {
    if (h.discrepancies === 0) return;
    navigate(`${all_routes.stockMovements}?inventory_id=${h.id}`);
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
            <div className="fw-700 fs-14">{nbCounted}/{editableRows.length}</div>
          </div>
          <div className="text-end">
            <div className="fs-11 text-muted">Écarts</div>
            <div className="fw-700 fs-14" style={{color: nbDiscrepancies > 0 ? '#dc2626' : '#16a34a'}}>{nbDiscrepancies}</div>
          </div>
          <button className="btn d-flex align-items-center gap-2" onClick={toggleHistory}
            style={{background: showHistory ? '#1a1a1a' : '#f3f4f6', color: showHistory ? '#fff' : '#1a1a1a', border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>
            <i className="ti ti-history fs-16"/>Historique
          </button>
          <button className="btn d-flex align-items-center gap-2"
            style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}
            onClick={() => downloadCsv(
              'Feuille_comptage_' + todayStr().replace(/\//g,'-') + '.csv',
              ['Produit', 'Unite', 'Stock theorique', 'Stock compte', 'Ecart'],
              editableRows.map(function(r) {
                return [r.product_name, r.unit_label, r.theoretical, r.counted || '', r.counted !== '' ? Number(r.counted) - r.theoretical : ''];
              })
            )}>
            <i className="ti ti-download fs-16"/>CSV
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

      {showHistory && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-0">
            <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
              <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>
                Historique des inventaires
              </h6>
            </div>
            {loadingHistory ? (
              <div className="text-center py-4"><div className="spinner-border spinner-border-sm" style={{color:'#F97316'}} role="status"/></div>
            ) : historyError ? (
              <div className="p-3 fs-13" style={{color:'#dc2626'}}>{historyError}</div>
            ) : history.length === 0 ? (
              <div className="text-center py-4"><p className="text-muted fs-13">Aucun inventaire enregistré pour l'instant</p></div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead style={{background:'#f8f9fa'}}>
                    <tr>
                      <th className="fs-12 fw-600 border-0 ps-3">Date</th>
                      <th className="fs-12 fw-600 border-0">Réalisé par</th>
                      <th className="fs-12 fw-600 border-0 text-center">Produits vérifiés</th>
                      <th className="fs-12 fw-600 border-0 text-center">Écarts</th>
                      <th className="fs-12 fw-600 border-0 pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id}>
                        <td className="ps-3 align-middle fs-13">{fmtDate(h.created_at)}</td>
                        <td className="align-middle fs-13">{h.created_by || '—'}</td>
                        <td className="align-middle text-center fs-13">{h.items_count}</td>
                        <td className="align-middle text-center fs-13 fw-600" style={{color: h.discrepancies > 0 ? '#dc2626' : '#16a34a'}}>{h.discrepancies}</td>
                        <td className="align-middle pe-3">
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm d-flex align-items-center gap-1" disabled={downloadingPdf === h.id}
                              onClick={() => handleDownloadPdf(h.id)}
                              style={{background:'#F97316',color:'#fff',border:'none',borderRadius:6,padding:'4px 10px',fontSize:12}}>
                              {downloadingPdf === h.id ? <span className="spinner-border spinner-border-sm"/> : <><i className="ti ti-file-download"/>PDF</>}
                            </button>
                            <button className="btn btn-sm d-flex align-items-center gap-1"
                              disabled={h.discrepancies === 0}
                              title={h.discrepancies === 0 ? "Aucun mouvement de stock pour cette session : tous les produits étaient conformes" : undefined}
                              onClick={() => goToMovements(h)}
                              style={{
                                background:'#f3f4f6',border:'none',borderRadius:6,padding:'4px 10px',fontSize:12,
                                opacity: h.discrepancies === 0 ? 0.5 : 1,
                                cursor: h.discrepancies === 0 ? 'not-allowed' : 'pointer',
                              }}>
                              <i className="ti ti-arrows-exchange"/>Mouvements
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {results && inventoryId && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-700 mb-3 d-flex align-items-center gap-2">
              <i className="ti ti-clipboard-check" style={{color:'#F97316'}}/>
              Résultat de l'inventaire ({results.length} produits vérifiés, {results.filter(r=>r.status!=='match').length} écarts traités)
            </h6>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-11 fw-600 border-0">Produit</th>
                    <th className="fs-11 fw-600 border-0 text-center">Écart</th>
                    <th className="fs-11 fw-600 border-0">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={idx}>
                      <td className="fs-13">{r.product_name} — {r.unit_label}</td>
                      <td className="text-center fw-600 fs-13" style={{color: r.delta > 0 ? '#16a34a' : r.delta < 0 ? '#dc2626' : '#888'}}>{fmt(r.delta)}</td>
                      <td>
                        {r.status === 'match' ? (
                          <span className="badge" style={{background:'#f3f4f6',color:'#6b7280',fontSize:11}}>Conforme</span>
                        ) : r.status === 'success' ? (
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
              <button className="btn btn-sm d-flex align-items-center gap-1" disabled={downloadingPdf === inventoryId} onClick={() => handleDownloadPdf(inventoryId)}
                style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontWeight:600}}>
                {downloadingPdf === inventoryId ? <span className="spinner-border spinner-border-sm"/> : <><i className="ti ti-file-download"/>Rapport PDF</>}
              </button>
              <button className="btn btn-sm" onClick={() => downloadCsv(
                'Resultat_inventaire_' + todayStr().replace(/\//g,'-') + '.csv',
                ['Produit', 'Unite', 'Ecart', 'Statut'],
                results.map(function(r) {
                  const label = r.status === 'match' ? 'Conforme' : r.status === 'success' ? 'Applique' : 'Echec: ' + (r.message || '');
                  return [r.product_name, r.unit_label, r.delta, label];
                })
              )}
                style={{background:'#f3f4f6',border:'none',borderRadius:8}}>
                <i className="ti ti-download me-1"/>CSV
              </button>
              <button className="btn btn-sm" onClick={() => { setResults(null); setInventoryId(null); }}
                style={{background:'#f3f4f6',border:'none',borderRadius:8}}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

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

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="p-3 border-bottom fs-12 text-muted" style={{borderColor:'#e5e7eb'}}>
            <i className="ti ti-info-circle me-1"/>
            Seule l'unité de base (ex. Pièce) est comptable — les niveaux supérieurs (Carton, Paquet...) sont affichés à titre de référence uniquement, pour éviter de compter deux fois le même stock.
          </div>
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
                      <tr key={row.product_unit_id} style={{opacity: row.editable ? 1 : 0.6}}>
                        <td className="ps-3 align-middle fw-600 fs-13">{row.product_name}</td>
                        <td className="align-middle fs-13">
                          {row.unit_label}
                          {!row.editable && <span className="badge ms-2" style={{background:'#f3f4f6',color:'#9ca3af',fontSize:10}}>Référence</span>}
                        </td>
                        <td className="align-middle text-center fs-13 text-muted">{row.theoretical}</td>
                        <td className="align-middle text-center">
                          {row.editable ? (
                            <input type="number" min={0} step={1} inputMode="numeric" pattern="[0-9]*"
                              placeholder="—"
                              value={row.counted}
                              onKeyDown={e => { if (e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault(); }}
                              onChange={e => updateCounted(row.product_unit_id, e.target.value)}
                              style={{
                                width: 80, textAlign:'center', padding:'4px 6px',
                                borderRadius: 6, border: '1px solid #e5e7eb',
                                background: hasCount && delta !== 0 ? '#fff7ed' : '#fff',
                              }}/>
                          ) : (
                            <span className="fs-12 text-muted">non comptable</span>
                          )}
                        </td>
                        <td className="align-middle text-center pe-3">
                          {row.editable && hasCount ? (
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
                  Vous vous apprêtez à enregistrer <strong>{nbCounted} produit{nbCounted > 1 ? 's' : ''} vérifié{nbCounted > 1 ? 's' : ''}</strong>,
                  dont <strong>{nbDiscrepancies} ajustement{nbDiscrepancies > 1 ? 's' : ''}</strong> de stock. Cette action est irréversible
                  (mais chaque ajustement reste tracé dans l'historique des mouvements, et un rapport PDF officiel complet sera généré).
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
