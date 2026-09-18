import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../core/services/apiService';
import { all_routes } from '../../router/all_routes';
import logo from '../../../assets/logo-64.png';

const SetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [form,    setForm]    = useState({ password:'', password_confirmation:'' });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

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
      setError(e.message || "Erreur lors de la reinitialisation.");
    } finally {
      setSaving(false);
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

                {missingParams ? (
                  <div className="text-center">
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', background: '#fef2f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                    }}>
                      <i className="ti ti-alert-circle" style={{ fontSize: 26, color: '#dc2626' }} />
                    </div>
                    <h1 style={{ fontSize: 22 }}>Lien invalide</h1>
                    <p className="login-subtitle">
                      Ce lien de reinitialisation est incomplet ou invalide. Merci d'en redemander un.
                    </p>
                    <Link to={all_routes.forgotPassword} className="btn-login mt-3">
                      Redemander un lien
                      <i className="ti ti-arrow-right" />
                    </Link>
                  </div>
                ) : success ? (
                  <div className="text-center">
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                    }}>
                      <i className="ti ti-circle-check" style={{ fontSize: 26, color: '#16a34a' }} />
                    </div>
                    <h1 style={{ fontSize: 22 }}>Mot de passe modifie</h1>
                    <p className="login-subtitle">Redirection vers la connexion...</p>
                  </div>
                ) : (
                  <>
                    <h1>Nouveau mot de passe</h1>
                    <p className="login-subtitle">
                      Pour le compte <strong>{email}</strong>
                    </p>

                    {error && (
                      <div className="login-error">
                        <i className="ti ti-alert-circle" />
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="login-form mt-3">
                      <div className="mb-3">
                        <label className="form-label">
                          Nouveau mot de passe <span className="text-danger">*</span>
                        </label>
                        <div className="input-group-login">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-control"
                            required
                            minLength={8}
                            value={form.password}
                            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                            autoComplete="new-password"
                            autoFocus
                          />
                          <span
                            className="input-icon"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ cursor: 'pointer' }}
                          >
                            <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} />
                          </span>
                        </div>
                        <div className="fs-11 text-muted mt-1">Minimum 8 caracteres.</div>
                      </div>

                      <div className="mb-4">
                        <label className="form-label">
                          Confirmer le mot de passe <span className="text-danger">*</span>
                        </label>
                        <div className="input-group-login">
                          <input
                            type={showPasswordConfirm ? 'text' : 'password'}
                            className="form-control"
                            required
                            minLength={8}
                            value={form.password_confirmation}
                            onChange={(e) => setForm(f => ({ ...f, password_confirmation: e.target.value }))}
                            autoComplete="new-password"
                          />
                          <span
                            className="input-icon"
                            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                            style={{ cursor: 'pointer' }}
                          >
                            <i className={`ti ${showPasswordConfirm ? 'ti-eye-off' : 'ti-eye'}`} />
                          </span>
                        </div>
                      </div>

                      <button type="submit" className="btn-login" disabled={saving}>
                        {saving ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" />
                            Enregistrement...
                          </>
                        ) : (
                          <>
                            Reinitialiser le mot de passe
                            <i className="ti ti-arrow-right" />
                          </>
                        )}
                      </button>
                    </form>
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

export default SetPassword;
