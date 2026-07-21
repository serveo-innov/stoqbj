import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../core/services/apiService';
import { all_routes } from '../../router/all_routes';

const SetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [form,    setForm]    = useState({ password:'', password_confirmation:'' });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const missingParams = !token || !email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { email, token, ...form });
      setSuccess(true);
      setTimeout(() => navigate(all_routes.login), 3000);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la réinitialisation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center flex-column"
         style={{ minHeight: '100vh', background: '#fff7ed' }}>
      <div className="card border-0 shadow-sm" style={{ width: 400, borderRadius: 16 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <span style={{ color: '#1a1a1a', fontWeight: 800, fontSize: 22 }}>
              Stock<span style={{ color: '#F97316' }}>.one</span>
            </span>
          </div>

          {missingParams ? (
            <div className="text-center">
              <i className="ti ti-alert-circle d-block mb-2" style={{fontSize:40,color:'#dc2626'}}/>
              <h5 className="fw-700 mb-2">Lien invalide</h5>
              <p className="fs-13 text-muted mb-4">
                Ce lien de réinitialisation est incomplet ou invalide. Merci d'en redemander un.
              </p>
              <Link to={all_routes.forgotPassword} className="btn w-100"
                style={{ background:'#F97316', color:'#fff', border:'none', borderRadius:8, padding:'10px', fontWeight:600 }}>
                Redemander un lien
              </Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <i className="ti ti-circle-check" style={{ fontSize: 26, color: '#16a34a' }}/>
              </div>
              <h5 className="fw-700 mb-2">Mot de passe modifié</h5>
              <p className="fs-13 text-muted">Redirection vers la connexion...</p>
            </div>
          ) : (
            <>
              <h5 className="fw-700 mb-1">Nouveau mot de passe</h5>
              <p className="fs-13 text-muted mb-4">Pour le compte <strong>{email}</strong></p>

              {error && (
                <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                  <i className="ti ti-alert-circle me-2"/>{error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fs-13 fw-600">Nouveau mot de passe</label>
                  <input type="password" className="form-control" required minLength={8}
                    value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))}
                    style={{borderColor:'#e5e7eb',borderRadius:8,padding:'10px 12px'}}/>
                  <div className="fs-11 text-muted mt-1">Minimum 8 caractères.</div>
                </div>
                <div className="mb-3">
                  <label className="form-label fs-13 fw-600">Confirmer le mot de passe</label>
                  <input type="password" className="form-control" required minLength={8}
                    value={form.password_confirmation} onChange={e => setForm(f=>({...f,password_confirmation:e.target.value}))}
                    style={{borderColor:'#e5e7eb',borderRadius:8,padding:'10px 12px'}}/>
                </div>
                <button type="submit" className="btn w-100" disabled={saving}
                  style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'10px',fontWeight:600}}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-2"/>Enregistrement...</> : 'Réinitialiser le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetPassword;
