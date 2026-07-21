import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../core/services/apiService';
import { all_routes } from '../../router/all_routes';

const ForgotPassword: React.FC = () => {
  const [email,   setEmail]   = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
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

          {sent ? (
            <div className="text-center">
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <i className="ti ti-mail-check" style={{ fontSize: 26, color: '#16a34a' }}/>
              </div>
              <h5 className="fw-700 mb-2">Email envoyé</h5>
              <p className="fs-13 text-muted mb-4">
                Si un compte existe avec l'adresse <strong>{email}</strong>, un email de réinitialisation
                vient d'être envoyé. Vérifiez votre boîte de réception (et vos spams).
              </p>
              <Link to={all_routes.login} className="btn w-100"
                style={{ background:'#F97316', color:'#fff', border:'none', borderRadius:8, padding:'10px', fontWeight:600 }}>
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h5 className="fw-700 mb-1">Mot de passe oublié ?</h5>
              <p className="fs-13 text-muted mb-4">
                Entrez votre email professionnel, nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              {error && (
                <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                  <i className="ti ti-alert-circle me-2"/>{error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fs-13 fw-600">Email</label>
                  <input type="email" className="form-control" required
                    placeholder="admin@maboutique.bj"
                    value={email} onChange={e => setEmail(e.target.value)}
                    style={{borderColor:'#e5e7eb',borderRadius:8,padding:'10px 12px'}}/>
                </div>
                <button type="submit" className="btn w-100" disabled={sending}
                  style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'10px',fontWeight:600}}>
                  {sending ? <><span className="spinner-border spinner-border-sm me-2"/>Envoi...</> : 'Envoyer le lien'}
                </button>
              </form>

              <div className="text-center mt-3">
                <Link to={all_routes.login} className="fs-13" style={{color:'#6b7280',textDecoration:'none'}}>
                  <i className="ti ti-arrow-left me-1"/>Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
