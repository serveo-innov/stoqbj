import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../core/hooks/useAuth';
import { all_routes } from '../../router/all_routes';
import logo from '../../../assets/logo-64.png';

const Login: React.FC = () => {
  const { login, loading, error } = useAuth();

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [attemptsLeft,    setAttemptsLeft]    = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err: any) {
      if (err?.attempts_remaining !== undefined) {
        setAttemptsLeft(err.attempts_remaining);
      }
    }
  };

  return (
    <div className="main-wrapper">
      <div className="login-content">
        <div className="row g-0">

          {/* ── Panneau gauche — Visuel Stoq ── */}
          <div className="col-lg-6 login-bg d-none d-lg-flex flex-column justify-content-center">
            <div className="login-brand">

              {/* Logo */}
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

              {/* Features */}
              <div className="login-features">
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="ti ti-shopping-cart" />
                  </div>
                  <div className="feature-text">
                    <h6>Caisse POS intuitive</h6>
                    <p>Ventes Gros, Détail & Extra en quelques clics</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="ti ti-chart-bar" />
                  </div>
                  <div className="feature-text">
                    <h6>Rapports en temps réel</h6>
                    <p>KPIs, CA quotidien et analyse des ventes</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="ti ti-credit-card" />
                  </div>
                  <div className="feature-text">
                    <h6>Gestion des crédits</h6>
                    <p>Suivi des débiteurs et relances automatiques</p>
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

          {/* ── Panneau droit — Formulaire ── */}
          <div className="col-lg-6 login-wrap-bg">
            <div className="login-wrapper">
              <div className="loginbox">

                {/* Logo mobile */}
                <div className="login-logo d-lg-none">
                  <div className="logo-icon" style={{ background: 'transparent' }}>
                    <img src={logo} alt="Stoq" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div className="logo-text">Stoq<span>.bj</span></div>
                </div>

                {/* Titre */}
                <h1>Connexion</h1>
                <p className="login-subtitle">
                  Connectez-vous à votre espace de gestion
                </p>

                {/* Erreur */}
                {error && (
                  <div className="login-error">
                    <i className="ti ti-alert-circle" />
                    {error}
                  </div>
                )}

                {/* Avertissement tentatives */}
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="attempts-warning">
                    <i className="ti ti-shield-exclamation me-1" />
                    {attemptsLeft} tentative{attemptsLeft > 1 ? 's' : ''} restante{attemptsLeft > 1 ? 's' : ''} avant blocage
                  </div>
                )}

                {/* Formulaire */}
                <form onSubmit={handleSubmit} className="login-form mt-3">

                  {/* Email */}
                  <div className="mb-3">
                    <label className="form-label">
                      Adresse email <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="email"
                        className="form-control"
                        placeholder="votre@email.com"
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

                  {/* Mot de passe */}
                  <div className="mb-4">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <label className="form-label mb-0">
                        Mot de passe <span className="text-danger">*</span>
                      </label>
                      <Link
                        to={all_routes.forgotPassword}
                        className="fs-12 text-orange"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <div className="input-group-login">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                      <span
                        className="input-icon"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ cursor: 'pointer' }}
                      >
                        <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} />
                      </span>
                    </div>
                  </div>

                  {/* Bouton */}
                  <button
                    type="submit"
                    className="btn-login"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" />
                        Connexion en cours...
                      </>
                    ) : (
                      <>
                        Se connecter
                        <i className="ti ti-arrow-right" />
                      </>
                    )}
                  </button>
                </form>

                {/* Créer un compte */}
                <div className="text-center mt-3">
                  <span className="fs-13 text-muted">Pas encore de boutique ? </span>
                  <Link to={all_routes.register} className="fs-13 text-orange">Créer mon compte</Link>
                </div>

                {/* Footer */}
                <div className="auth-footer">
                  <span>Stoq.bj</span> — Gestion de stocks pour papeteries<br />
                  Bénin / Afrique de l'Ouest &nbsp;|&nbsp; v1.0.0
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
