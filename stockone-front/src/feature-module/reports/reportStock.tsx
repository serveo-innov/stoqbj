import React, { useEffect, useState } from 'react';
import api from '../../core/services/apiService';
import { API_BASE_URL } from '../../environment';

interface CategoryBreakdown {
  category: string;
  nb_products: number;
  stock_value: number;
}

interface StockReportData {
  total_units: number;
  stock_value_cost: number;
  stock_value_retail: number;
  potential_margin: number;
  out_of_stock: number;
  low_stock: number;
  by_category: CategoryBreakdown[];
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';

const getToken = (): string | null => localStorage.getItem('stockone_token');
const getShopId = (): number | null => {
  const user = JSON.parse(localStorage.getItem('stockone_user') || 'null');
  return user?.role === 'super_admin' ? null : user?.shop?.id ?? null;
};

const ReportStock: React.FC = () => {
  const [data,    setData]    = useState<StockReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: StockReportData }>('/reports/stock');
      setData(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE_URL}/exports/stock`);
      const shopId = getShopId();
      if (shopId) url.searchParams.set('shop_id', String(shopId));
      const token = getToken();

      const response = await fetch(url.toString(), {
        headers: { 'Accept':'text/csv', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || `Erreur ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition && disposition.match(/filename="?(.+)"?/);
      const filename = match ? match[1].replace(/"/g,'') : 'stock.csv';

      const link = document.createElement('a');
      const objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Rapport Stock</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Rapports</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Stock</li>
          </ol>
        </div>
        <button className="btn btn-sm d-flex align-items-center gap-2" disabled={exporting} onClick={handleExport}
          style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>
          {exporting ? <span className="spinner-border spinner-border-sm"/> : <><i className="ti ti-download"/>Exporter CSV</>}
        </button>
      </div>

      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
          <button className="btn-close ms-auto" onClick={() => setError(null)}/>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
      ) : data && (
        <>
          {/* KPIs */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="kpi-card">
                <p className="kpi-label mb-1">Unités en stock</p>
                <h3 className="kpi-value">{data.total_units}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
                <p className="kpi-label mb-1">Ruptures</p>
                <h3 className="kpi-value" style={{color:'#dc2626'}}>{data.out_of_stock}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#EA580C'}}>
                <p className="kpi-label mb-1">Stocks bas</p>
                <h3 className="kpi-value" style={{color:'#EA580C'}}>{data.low_stock}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card" style={{borderLeftColor:'#16a34a'}}>
                <p className="kpi-label mb-1">Marge potentielle</p>
                <h3 className="kpi-value" style={{color:'#16a34a'}}>{fmt(data.potential_margin)}</h3>
              </div>
            </div>
          </div>

          {/* Valeur du stock */}
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <p className="fs-12 text-muted mb-1">Valeur du stock (prix d'achat)</p>
                  <h4 className="fw-700 mb-0">{fmt(data.stock_value_cost)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <p className="fs-12 text-muted mb-1">Valeur du stock (prix de vente)</p>
                  <h4 className="fw-700 mb-0" style={{color:'#F97316'}}>{fmt(data.stock_value_retail)}</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Répartition par catégorie */}
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="p-3 border-bottom" style={{borderColor:'#e5e7eb'}}>
                <h6 className="fw-700 mb-0 d-flex align-items-center gap-2">
                  <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>
                  Répartition par catégorie
                </h6>
              </div>
              {data.by_category.length === 0 ? (
                <div className="text-center py-5"><p className="text-muted">Aucune donnée</p></div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead style={{background:'#f8f9fa'}}>
                      <tr>
                        <th className="fs-12 fw-600 border-0 ps-3">Catégorie</th>
                        <th className="fs-12 fw-600 border-0 text-center">Nb produits</th>
                        <th className="fs-12 fw-600 border-0 text-end pe-3">Valeur stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_category
                        .sort((a, b) => b.stock_value - a.stock_value)
                        .map((c, idx) => (
                        <tr key={idx}>
                          <td className="ps-3 align-middle fw-600 fs-13">{c.category}</td>
                          <td className="align-middle text-center fs-13">{c.nb_products}</td>
                          <td className="align-middle text-end pe-3 fw-600 fs-13" style={{color:'#F97316'}}>{fmt(c.stock_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportStock;
