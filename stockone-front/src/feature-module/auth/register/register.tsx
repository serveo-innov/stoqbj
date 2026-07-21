import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../core/hooks/useAuth';
import { all_routes } from '../../router/all_routes';
import logo from '../../../assets/logo-64.png';

const emptyForm = {
  shop_name: '', commercial_name: '', owner_name: '', owner_firstname: '',
  owner_phone: '', owner_email: '', address: '', city: '', neighborhood: '',
  password: '', password_confirmation: '',
};

const Register: React.FC = () => {
  const { registerShop, loading, error } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const update = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerShop(form);
    } catch {
      // l'erreur est déjà gérée par useAuth (state.error)
    }
  };

  return (
    <div className="main-wrapper">
      <div className="login-content">
        <div className="row g-0">

          {/* ── Panneau gauche — Visuel Stoq ── */}
          <div className="col-lg-6 login-bg d-none d-lg-flex flex-column justify-content-center"
               style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
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
                    <i className="ti ti-rocket" />
                  </div>
                  <div className="feature-text">
                    <h6>7 jours d'essai gratuit</h6>
                    <p>Testez toutes les fonctionnalités sans engagement</p>
                  </div>
                </div>
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
                    <i className="ti ti-device-mobile" />
                  </div>
                  <div className="feature-text">
                    <h6>Abonnement Mobile Money</h6>
                    <p>Payez facilement via Kkiapay quand vous êtes prêt</p>
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

                <div className="login-logo d-lg-none">
                  <div className="logo-icon" style={{ background: 'transparent' }}>
                    <img src={logo} alt="Stoq" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div className="logo-text">Stoq<span>.bj</span></div>
                </div>

                <h1>Créer ma boutique</h1>
                <p className="login-subtitle">
                  7 jours d'essai gratuit, sans carte bancaire requise
                </p>

                {error && (
                  <div className="login-error">
                    <i className="ti ti-alert-circle" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="login-form mt-3">

                  {/* Nom de la boutique */}
                  <div className="mb-3">
                    <label className="form-label">
                      Nom de la boutique <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="text" className="form-control" required
                        placeholder="Papeterie du Marché"
                        value={form.shop_name} onChange={update('shop_name')}
                      />
                      <span className="input-icon"><i className="ti ti-building-store" /></span>
                    </div>
                  </div>

                  {/* Ville */}
                  <div className="mb-3">
                    <label className="form-label">
                      Ville <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="text" className="form-control" required
                        placeholder="Cotonou"
                        value={form.city} onChange={update('city')}
                      />
                      <span className="input-icon"><i className="ti ti-map-pin" /></span>
                    </div>
                  </div>

                  {/* Nom */}
                  <div className="mb-3">
                    <label className="form-label">
                      Votre nom <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="text" className="form-control" required
                        value={form.owner_name} onChange={update('owner_name')}
                      />
                      <span className="input-icon"><i className="ti ti-user" /></span>
                    </div>
                  </div>

                  {/* Prénom */}
                  <div className="mb-3">
                    <label className="form-label">
                      Votre prénom <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="text" className="form-control" required
                        value={form.owner_firstname} onChange={update('owner_firstname')}
                      />
                      <span className="input-icon"><i className="ti ti-user" /></span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="mb-3">
                    <label className="form-label">
                      Adresse email <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="email" className="form-control" required
                        placeholder="votre@email.com" autoComplete="email"
                        value={form.owner_email} onChange={update('owner_email')}
                      />
                      <span className="input-icon"><i className="ti ti-mail" /></span>
                    </div>
                  </div>

                  {/* Téléphone */}
                  <div className="mb-3">
                    <label className="form-label">
                      Téléphone <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="text" className="form-control" required
                        placeholder="+229 97 00 00 00"
                        value={form.owner_phone} onChange={update('owner_phone')}
                      />
                      <span className="input-icon"><i className="ti ti-phone" /></span>
                    </div>
                  </div>

                  {/* Adresse */}
                  <div className="mb-3">
                    <label className="form-label">
                      Adresse de la boutique <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type="text" className="form-control" required
                        value={form.address} onChange={update('address')}
                      />
                      <span className="input-icon"><i className="ti ti-map-2" /></span>
                    </div>
                  </div>

                  {/* Mot de passe */}
                  <div className="mb-3">
                    <label className="form-label">
                      Mot de passe <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control" required minLength={8}
                        placeholder="••••••••" autoComplete="new-password"
                        value={form.password} onChange={update('password')}
                      />
                      <span
                        className="input-icon"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ cursor: 'pointer' }}
                      >
                        <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} />
                      </span>
                    </div>
                    <div className="fs-12 text-muted mt-1">Minimum 8 caractères.</div>
                  </div>

                  {/* Confirmer mot de passe */}
                  <div className="mb-4">
                    <label className="form-label">
                      Confirmer le mot de passe <span className="text-danger">*</span>
                    </label>
                    <div className="input-group-login">
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        className="form-control" required minLength={8}
                        placeholder="••••••••" autoComplete="new-password"
                        value={form.password_confirmation} onChange={update('password_confirmation')}
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

                  <button type="submit" className="btn-login" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        Créer ma boutique
                        <i className="ti ti-arrow-right" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center mt-3">
                  <span className="fs-13 text-muted">Déjà un compte ? </span>
                  <Link to={all_routes.login} className="fs-13 text-orange">Se connecter</Link>
                </div>

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

export default Register;
