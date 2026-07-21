import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../../core/services/apiService';
import store from '../../core/redux/store';

type RootState = ReturnType<typeof store.getState>;

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_shop:  'Admin Boutique',
  gerant:      'Gérant',
  caissier:    'Caissier',
};

const permissionLabels: Record<string, string> = {
  can_manage_catalogue:     'Gérer le catalogue',
  can_view_full_reports:    'Voir les rapports complets',
  can_adjust_prices:        'Ajuster les prix',
  can_manage_users:         'Gérer les utilisateurs',
  can_manage_shop_settings: 'Gérer les paramètres boutique',
  can_validate_stock_adj:   'Valider les ajustements de stock',
  can_manage_shops:         'Gérer les boutiques (plateforme)',
};

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

const MyProfile: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  const [pwdForm, setPwdForm] = useState({ current_password:'', password:'', password_confirmation:'' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/users/me/password', pwdForm);
      setSuccess('Mot de passe modifié. Vous devrez vous reconnecter à la prochaine session.');
      setPwdForm({ current_password:'', password:'', password_confirmation:'' });
    } catch (e: any) {
      setError(e.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" style={{color:'#F97316'}} role="status"/>
      </div>
    );
  }

  const initials = `${user.firstname?.[0] || ''}${user.name?.[0] || ''}`.toUpperCase();
  const activePermissions = Object.entries(user.permissions || {}).filter(([, v]) => v);

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Mon Profil</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Compte</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Mon Profil</li>
          </ol>
        </div>
      </div>

      <div className="row g-3">
        {/* Carte identité */}
        <div className="col-xl-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center p-4">
              <div style={{
                width:80, height:80, borderRadius:'50%', background:'#F97316',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:28, fontWeight:700, margin:'0 auto 16px'
              }}>
                {initials || <i className="ti ti-user"/>}
              </div>
              <h5 className="fw-700 mb-1">{user.firstname} {user.name}</h5>
              <span className="badge mb-3" style={{background:'#fff7ed',color:'#F97316',border:'1px solid #FED7AA',fontSize:12}}>
                {roleLabels[user.role] || user.role}
              </span>

              <div className="text-start mt-3 pt-3" style={{borderTop:'1px solid #f3f4f6'}}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="ti ti-mail" style={{color:'#9ca3af',width:20}}/>
                  <span className="fs-13">{user.email}</span>
                </div>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="ti ti-phone" style={{color:'#9ca3af',width:20}}/>
                  <span className="fs-13">{user.phone || '—'}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <i className="ti ti-clock" style={{color:'#9ca3af',width:20}}/>
                  <span className="fs-13">Dernière connexion : {fmtDate(user.last_login_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Boutique */}
          {user.shop && (
            <div className="card border-0 shadow-sm mt-3">
              <div className="card-body">
                <h6 className="fw-700 mb-3 d-flex align-items-center gap-2">
                  <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>
                  Boutique
                </h6>
                <div className="fs-14 fw-600">{user.shop.commercial_name || user.shop.shop_name}</div>
                <div className="fs-12 text-muted mb-2">{user.shop.shop_name}</div>
                <span className="badge" style={{
                  background: user.shop.status === 'active' ? '#f0fdf4' : user.shop.status === 'trial' ? '#fffbeb' : '#fef2f2',
                  color:      user.shop.status === 'active' ? '#16a34a' : user.shop.status === 'trial' ? '#d97706' : '#dc2626',
                  fontSize:11
                }}>
                  {user.shop.status === 'active' ? 'Actif' : user.shop.status === 'trial' ? 'Période d\'essai' : user.shop.status}
                </span>
                {user.shop.days_until_expiry !== undefined && user.shop.days_until_expiry !== null && (
                  <div className="fs-12 text-muted mt-2">
                    Expire dans {user.shop.days_until_expiry} jour{user.shop.days_until_expiry > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Permissions + Mot de passe */}
        <div className="col-xl-8">
          {/* Permissions */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h6 className="fw-700 mb-3 d-flex align-items-center gap-2">
                <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>
                Mes permissions
              </h6>
              {activePermissions.length === 0 ? (
                <p className="text-muted fs-13">Aucune permission spécifique.</p>
              ) : (
                <div className="row g-2">
                  {activePermissions.map(([key]) => (
                    <div className="col-md-6" key={key}>
                      <div className="d-flex align-items-center gap-2 p-2 rounded-3" style={{background:'#f0fdf4'}}>
                        <i className="ti ti-circle-check" style={{color:'#16a34a'}}/>
                        <span className="fs-13">{permissionLabels[key] || key}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Changement mot de passe */}
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="fw-700 mb-3 d-flex align-items-center gap-2">
                <div style={{width:4,height:20,background:'#1a1a1a',borderRadius:2}}/>
                Changer mon mot de passe
              </h6>

              {success && (
                <div className="alert mb-3 d-flex align-items-center gap-2"
                  style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,color:'#16a34a',fontSize:13}}>
                  <i className="ti ti-circle-check"/>{success}
                </div>
              )}
              {error && (
                <div className="alert mb-3 d-flex align-items-center gap-2"
                  style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                  <i className="ti ti-alert-circle"/>{error}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit}>
                <div className="mb-3">
                  <label className="form-label fs-13 fw-600">Mot de passe actuel <span className="text-danger">*</span></label>
                  <input type="password" className="form-control" required
                    value={pwdForm.current_password}
                    onChange={e => setPwdForm(f=>({...f,current_password:e.target.value}))}
                    style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">Nouveau mot de passe <span className="text-danger">*</span></label>
                    <input type="password" className="form-control" required minLength={8}
                      value={pwdForm.password}
                      onChange={e => setPwdForm(f=>({...f,password:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13 fw-600">Confirmer <span className="text-danger">*</span></label>
                    <input type="password" className="form-control" required minLength={8}
                      value={pwdForm.password_confirmation}
                      onChange={e => setPwdForm(f=>({...f,password_confirmation:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="fs-11 text-muted mb-3">Minimum 8 caractères. Vous devrez vous reconnecter après ce changement.</div>
                <button type="submit" className="btn" disabled={saving}
                  style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600,padding:'10px 24px'}}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-2"/>Modification...</> : <><i className="ti ti-key me-2"/>Modifier le mot de passe</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
