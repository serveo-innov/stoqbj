import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../core/services/apiService';
import { all_routes } from '../../router/all_routes';
import logo from '../../../assets/logo-64.png';

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
    <div className="main-wrapper">
      <div className="login-content">
        <div className="row g-0">

          {/* -- Panneau gauche -- Visuel Stoq -- */}
          <div className="col-lg-6 login-bg d-none d-lg-flex flex-column justify-content-center">
            <div className="login-brand">
              <div className="brand-logo">
                <div className="brand-icon" style={{ background: 'transparent' }}>
                  <img src={logo} alt="Stoq" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div className="brand-name">
                  Stoq<span>.bj</span>
                </div>
              </div>

              <p className="brand-tagline">
                La plateforme de gestion de stocks pour papeteries en Afrique de l'Ouest
              </p>

              <div className="login-features">
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="ti ti-shopping-cart" />
                  </div>
                  <div className="feature-text">
                    <h6>Caisse POS intuitive</h6>
                    <p>Ventes Gros, Detail & Extra en quelques clics</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="ti ti-chart-bar" />
                  </div>
                  <div className="feature-text">
                    <h6>Rapports en temps reel</h6>
                    <p>KPIs, CA quotidien et analyse des ventes</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="ti ti-credit-card" />
                  </div>
                  <div className="feature-text">
                    <h6>Gestion des credits</h6>
                    <p>Suivi des debiteurs et relances automatiques</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="ti ti-package" />
                  </div>
                  <div className="feature-text">
                    <h6>Stocks intelligents</h6>
                    <p>Alertes, produits dormants et suggestions IA</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* -- Panneau droit -- Formulaire -- */}
          <div className="col-lg-6 login-wrap-bg">
            <div className="login-wrapper">
              <div className="loginbox">

                <div className="login-logo d-lg-none">
                  <div className="logo-icon" style={{ background: 'transparent' }}>
                    <img src={logo} alt="Stoq" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div className="logo-text">Stoq<span>.bj</span></div>
                </div>

                {sent ? (
                  <div className="text-center">
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                    }}>
                      <i className="ti ti-mail-check" style={{ fontSize: 26, color: '#16a34a' }} />
                    </div>
                    <h1 style={{ fontSize: 22 }}>Email envoye</h1>
                    <p className="login-subtitle">
                      Si un compte existe avec l'adresse <strong>{email}</strong>, un email de reinitialisation
                      vient d'etre envoye. Verifiez votre boite de reception (et vos spams).
                    </p>
                    <Link to={all_routes.login} className="btn-login mt-3">
                      Retour a la connexion
                      <i className="ti ti-arrow-right" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <h1>Mot de passe oublie ?</h1>
                    <p className="login-subtitle">
                      Entrez votre email professionnel, nous vous enverrons un lien pour reinitialiser votre mot de passe.
                    </p>

                    {error && (
                      <div className="login-error">
                        <i className="ti ti-alert-circle" />
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="login-form mt-3">
                      <div className="mb-4">
                        <label className="form-label">
                          Adresse email <span className="text-danger">*</span>
                        </label>
                        <div className="input-group-login">
                          <input
                            type="email"
                            className="form-control"
                            placeholder="admin@maboutique.bj"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            autoFocus
                          />
                          <span className="input-icon">
                            <i className="ti ti-mail" />
                          </span>
                        </div>
                      </div>

                      <button type="submit" className="btn-login" disabled={sending}>
                        {sending ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" />
                            Envoi...
                          </>
                        ) : (
                          <>
                            Envoyer le lien
                            <i className="ti ti-arrow-right" />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="text-center mt-3">
                      <Link to={all_routes.login} className="fs-13 text-orange">
                        <i className="ti ti-arrow-left me-1" />Retour a la connexion
                      </Link>
                    </div>
                  </>
                )}

                <div className="auth-footer">
                  <span>Stoq.bj</span> -- Gestion de stocks pour papeteries<br />
                  Benin / Afrique de l'Ouest &nbsp;|&nbsp; v1.0.0
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;