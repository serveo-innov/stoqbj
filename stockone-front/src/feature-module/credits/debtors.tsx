import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';

interface Debtor {
  client_id: number;
  client_name: string;
  client_phone: string;
  nb_credits: number;
  total_remaining: number;
  oldest_due_date: string;
  has_overdue: boolean;
  has_doubtful: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' F';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

const Debtors: React.FC = () => {
  const [debtors,  setDebtors]  = useState<Debtor[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: Debtor[] }>('/credits/debtors');
      setDebtors(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const filtered = debtors.filter(d =>
    d.client_name.toLowerCase().includes(search.toLowerCase()) ||
    d.client_phone.includes(search)
  );

  const totalDue     = debtors.reduce((sum, d) => sum + d.total_remaining, 0);
  const nbOverdue    = debtors.filter(d => d.has_overdue).length;
  const nbDoubtful   = debtors.filter(d => d.has_doubtful).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Tableau des débiteurs</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Finance</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Débiteurs</li>
          </ol>
        </div>
        <Link to={all_routes.credits} className="btn d-flex align-items-center gap-2"
          style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,color:'#1a1a1a'}}>
          <i className="ti ti-credit-card fs-16"/>Voir tous les crédits
        </Link>
      </div>

      {error && (
        <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle me-2"/>{error}
        </div>
      )}

      {/* KPIs */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card" style={{borderLeftColor:'#dc2626'}}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="kpi-label mb-1">Total restant dû</p>
                <h3 className="kpi-value" style={{color:'#dc2626', fontSize:18}}>{fmt(totalDue)}</h3>
              </div>
              <div className="kpi-icon" style={{background:'#fef2f2',color:'#dc2626'}}>
                <i className="ti ti-currency-franc"/>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="kpi-label mb-1">Débiteurs</p>
                <h3 className="kpi-value">{debtors.length}</h3>
              </div>
              <div className="kpi-icon"><i className="ti ti-users"/></div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card" style={{borderLeftColor:'#EA580C'}}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="kpi-label mb-1">En retard</p>
                <h3 className="kpi-value" style={{color:'#EA580C'}}>{nbOverdue}</h3>
              </div>
              <div className="kpi-icon" style={{background:'#fff7ed',color:'#EA580C'}}>
                <i className="ti ti-clock-exclamation"/>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card" style={{borderLeftColor:'#7c3aed'}}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="kpi-label mb-1">Créances douteuses</p>
                <h3 className="kpi-value" style={{color:'#7c3aed'}}>{nbDoubtful}</h3>
              </div>
              <div className="kpi-icon" style={{background:'#f5f3ff',color:'#7c3aed'}}>
                <i className="ti ti-alert-octagon"/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="position-relative" style={{maxWidth:400}}>
            <input type="text" className="form-control"
              placeholder="Rechercher par nom ou téléphone..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{paddingLeft:40,borderColor:'#e5e7eb',borderRadius:8}}/>
            <i className="ti ti-search position-absolute"
              style={{left:12,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}/>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="ti ti-users d-block mb-2" style={{fontSize:48,color:'#d1d5db'}}/>
              <p className="text-muted">
                {search ? 'Aucun débiteur trouvé' : 'Aucun débiteur en cours'}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">#</th>
                    <th className="fs-12 fw-600 border-0">Client</th>
                    <th className="fs-12 fw-600 border-0 text-center">Crédits</th>
                    <th className="fs-12 fw-600 border-0 text-end">Montant dû</th>
                    <th className="fs-12 fw-600 border-0">Échéance la + ancienne</th>
                    <th className="fs-12 fw-600 border-0 text-center">Statut</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, idx) => (
                    <tr key={d.client_id}>
                      <td className="ps-3 align-middle">
                        <span style={{
                          width:28, height:28, borderRadius:'50%',
                          background: idx < 3 ? '#F97316' : '#f3f4f6',
                          color: idx < 3 ? '#fff' : '#6b7280',
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                          fontSize:12, fontWeight:700
                        }}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="align-middle">
                        <div className="fw-600 fs-13">{d.client_name}</div>
                        <div className="fs-11 text-muted">{d.client_phone}</div>
                      </td>
                      <td className="align-middle text-center">
                        <span className="badge" style={{background:'#fff7ed',color:'#EA580C',border:'1px solid #FED7AA',fontSize:11}}>
                          {d.nb_credits} crédit{d.nb_credits > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="align-middle text-end fw-700 fs-14" style={{color:'#dc2626'}}>
                        {fmt(d.total_remaining)}
                      </td>
                      <td className="align-middle fs-13">{fmtDate(d.oldest_due_date)}</td>
                      <td className="align-middle text-center">
                        {d.has_doubtful ? (
                          <span className="badge" style={{background:'#f5f3ff',color:'#7c3aed',fontSize:11}}>Douteux</span>
                        ) : d.has_overdue ? (
                          <span className="badge" style={{background:'#fef2f2',color:'#dc2626',fontSize:11}}>En retard</span>
                        ) : (
                          <span className="badge" style={{background:'#fffbeb',color:'#d97706',fontSize:11}}>En cours</span>
                        )}
                      </td>
                      <td className="align-middle text-end pe-3">
                        <Link to={all_routes.credits}
                          className="btn btn-sm"
                          style={{background:'#F97316',color:'#fff',borderRadius:6,fontSize:12,border:'none'}}>
                          <i className="ti ti-cash me-1"/>Encaisser
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Debtors;
