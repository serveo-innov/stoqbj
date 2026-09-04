import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';
import { decomposeStock } from '../../core/utils/stockDecompose';
import type { DecomposableUnit } from '../../core/utils/stockDecompose';

interface StockAlert {
  product_unit_id: number;
  product_name: string;
  unit_label: string;
  level: number;
  qty_in_parent: number;
  category: string | null;
  stock_qty: number;
  stock_alert_threshold: number;
  status: 'out_of_stock' | 'low_stock';
  sibling_units: DecomposableUnit[];
}

const StockAlerts: React.FC = () => {
  const [alerts,  setAlerts]  = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: StockAlert[]; count: number }>('/stock/alerts');
      setAlerts(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const outOfStock = alerts.filter(a => a.status === 'out_of_stock');
  const lowStock   = alerts.filter(a => a.status === 'low_stock');

  return (
    <div>
      <style>{`
        @keyframes blink-badge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
      <div className="page-header">
        <div>
          <h4 className="page-title">Alertes Stock</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Stock</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Alertes</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2"
          style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}
          onClick={load}>
          <i className="ti ti-refresh fs-16"/>Actualiser
        </button>
      </div>

      {error && (
        <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle me-2"/>{error}
        </div>
      )}

      {/* Compteurs */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="kpi-label mb-1">Ruptures de stock</p>
                <h3 className="kpi-value" style={{color:'#dc2626'}}>{outOfStock.length}</h3>
              </div>
              <div className="kpi-icon" style={{background:'#fef2f2',color:'#dc2626'}}>
                <i className="ti ti-package-off"/>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card" style={{borderLeftColor:'#EA580C'}}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="kpi-label mb-1">Stocks bas</p>
                <h3 className="kpi-value" style={{color:'#EA580C'}}>{lowStock.length}</h3>
              </div>
              <div className="kpi-icon" style={{background:'#fff7ed',color:'#EA580C'}}>
                <i className="ti ti-alert-triangle"/>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="kpi-label mb-1">Total alertes</p>
                <h3 className="kpi-value">{alerts.length}</h3>
              </div>
              <div className="kpi-icon">
                <i className="ti ti-bell"/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
        </div>
      ) : alerts.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <i className="ti ti-circle-check d-block mb-2" style={{fontSize:48,color:'#16a34a'}}/>
            <h6 className="fw-600">Aucune alerte stock !</h6>
            <p className="text-muted fs-13">Tous les produits ont un niveau de stock correct.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Ruptures */}
          {outOfStock.length > 0 && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body p-0">
                <div className="p-3" style={{background:'#fef2f2',borderRadius:'8px 8px 0 0',borderBottom:'1px solid #fca5a5'}}>
                  <h6 className="fw-700 mb-0 d-flex align-items-center gap-2" style={{color:'#dc2626'}}>
                    <i className="ti ti-package-off"/>
                    Ruptures de stock ({outOfStock.length})
                  </h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead style={{background:'#f8f9fa'}}>
                      <tr>
                        <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                        <th className="fs-12 fw-600 border-0">Unité</th>
                        <th className="fs-12 fw-600 border-0">Catégorie</th>
                        <th className="fs-12 fw-600 border-0 text-center">Stock</th>
                        <th className="fs-12 fw-600 border-0 text-end pe-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outOfStock.map(a => (
                        <tr key={a.product_unit_id}>
                          <td className="ps-3 align-middle fw-600 fs-13">{a.product_name}</td>
                          <td className="align-middle fs-13">{a.unit_label}</td>
                          <td className="align-middle fs-13 text-muted">{a.category || '—'}</td>
                          <td className="align-middle text-center">
                            <span className="badge" style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',fontSize:12,animation:'blink-badge 1s ease-in-out 3'}}>
                              0 unité
                            </span>
                            {a.level === 1 && a.sibling_units.length > 1 && (
                              <div className="fs-11 text-muted mt-1">{decomposeStock(a.stock_qty, a.sibling_units)}</div>
                            )}
                          </td>
                          <td className="align-middle text-end pe-3">
                            <Link to={`${all_routes.stockEntry}?unit=${a.product_unit_id}`} className="btn btn-sm"
                              style={{background:'#F97316',color:'#fff',borderRadius:6,fontSize:12,border:'none'}}>
                              <i className="ti ti-plus me-1"/>Réapprovisionner
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Stocks bas */}
          {lowStock.length > 0 && (
            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="p-3" style={{background:'#fff7ed',borderRadius:'8px 8px 0 0',borderBottom:'1px solid #FED7AA'}}>
                  <h6 className="fw-700 mb-0 d-flex align-items-center gap-2" style={{color:'#EA580C'}}>
                    <i className="ti ti-alert-triangle"/>
                    Stocks bas ({lowStock.length})
                  </h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead style={{background:'#f8f9fa'}}>
                      <tr>
                        <th className="fs-12 fw-600 border-0 ps-3">Produit</th>
                        <th className="fs-12 fw-600 border-0">Unité</th>
                        <th className="fs-12 fw-600 border-0">Catégorie</th>
                        <th className="fs-12 fw-600 border-0 text-center">Stock</th>
                        <th className="fs-12 fw-600 border-0 text-center">Seuil</th>
                        <th className="fs-12 fw-600 border-0 text-end pe-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map(a => (
                        <tr key={a.product_unit_id}>
                          <td className="ps-3 align-middle fw-600 fs-13">{a.product_name}</td>
                          <td className="align-middle fs-13">{a.unit_label}</td>
                          <td className="align-middle fs-13 text-muted">{a.category || '—'}</td>
                          <td className="align-middle text-center">
                            <span className="fw-700 fs-14" style={{color:'#EA580C',animation:'blink-badge 1s ease-in-out 3',display:'inline-block'}}>{a.stock_qty}</span>
                            {a.level === 1 && a.sibling_units.length > 1 && (
                              <div className="fs-11 text-muted">{decomposeStock(a.stock_qty, a.sibling_units)}</div>
                            )}
                          </td>
                          <td className="align-middle text-center fs-13 text-muted">{a.stock_alert_threshold}</td>
                          <td className="align-middle text-end pe-3">
                            <Link to={`${all_routes.stockEntry}?unit=${a.product_unit_id}`} className="btn btn-sm"
                              style={{background:'#fff7ed',color:'#EA580C',borderRadius:6,fontSize:12,border:'1px solid #FED7AA'}}>
                              <i className="ti ti-arrow-up me-1"/>Commander
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StockAlerts;
