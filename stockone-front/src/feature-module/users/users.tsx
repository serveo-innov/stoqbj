import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../../core/services/apiService';
import store from '../../core/redux/store';

type RootState = ReturnType<typeof store.getState>;

interface UserItem {
  id: number;
  name: string;
  firstname: string;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'admin_shop' | 'gerant' | 'caissier';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label:'Super Admin', color:'#7c3aed', bg:'#f5f3ff' },
  admin_shop:  { label:'Admin Boutique', color:'#F97316', bg:'#fff7ed' },
  gerant:      { label:'Gérant',      color:'#0891b2', bg:'#ecfeff' },
  caissier:    { label:'Caissier',    color:'#16a34a', bg:'#f0fdf4' },
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Jamais connecté';

const emptyForm = { name:'', firstname:'', email:'', phone:'', password:'', role:'caissier' as UserItem['role'] };

const Users: React.FC = () => {
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const [users,    setUsers]    = useState<UserItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [search,   setSearch]   = useState('');

  // Création / édition
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<UserItem | null>(null);
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);

  // Mot de passe
  const [pwdTarget, setPwdTarget] = useState<UserItem | null>(null);
  const [pwdForm,   setPwdForm]   = useState({ password:'', password_confirmation:'' });
  const [pwdSaving, setPwdSaving] = useState(false);

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleting,      setDeleting]     = useState(false);
  const [togglingId,    setTogglingId]   = useState<number | null>(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const allowedRoles: UserItem['role'][] = isSuperAdmin ? ['admin_shop', 'gerant', 'caissier'] : ['gerant', 'caissier'];

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: UserItem[] }>('/users');
      setUsers(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const filtered = users.filter(u =>
    `${u.firstname} ${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); setError(null); };
  const openEdit = (u: UserItem) => {
    setEditing(u);
    setForm({ name:u.name, firstname:u.firstname, email:u.email, phone:u.phone || '', password:'', role:u.role });
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, {
          name: form.name, firstname: form.firstname, phone: form.phone || null, role: form.role,
        });
        setSuccess('Utilisateur modifié.');
      } else {
        await api.post('/users', {
          name: form.name, firstname: form.firstname, email: form.email,
          phone: form.phone || undefined, password: form.password, role: form.role,
        });
        setSuccess('Utilisateur créé.');
      }
      setShowForm(false);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u: UserItem) => {
    setTogglingId(u.id);
    setError(null);
    try {
      const res = await api.post<{ is_active: boolean }>(`/users/${u.id}/toggle`);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: res.is_active } : x));
    } catch (e: any) { setError(e.message); }
    finally { setTogglingId(null); }
  };

  const openPassword = (u: UserItem) => { setPwdTarget(u); setPwdForm({ password:'', password_confirmation:'' }); setError(null); };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTarget) return;
    setPwdSaving(true);
    setError(null);
    try {
      await api.post(`/users/${pwdTarget.id}/password`, pwdForm);
      setSuccess('Mot de passe modifié.');
      setPwdTarget(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setPwdSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setSuccess('Utilisateur supprimé.');
      setDeleteTarget(null);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Utilisateurs</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Admin</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Utilisateurs</li>
          </ol>
        </div>
        <button className="btn d-flex align-items-center gap-2"
          onClick={openCreate}
          style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>
          <i className="ti ti-user-plus fs-16"/>Nouvel utilisateur
        </button>
      </div>

      {success && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,color:'#16a34a'}}>
          <i className="ti ti-circle-check"/>{success}
        </div>
      )}
      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
          <button className="btn-close ms-auto" onClick={() => setError(null)}/>
        </div>
      )}

      {/* Recherche */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="position-relative" style={{maxWidth:400}}>
            <input type="text" className="form-control"
              placeholder="Rechercher par nom ou email..."
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
              <p className="text-muted">{search ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{background:'#f8f9fa'}}>
                  <tr>
                    <th className="fs-12 fw-600 border-0 ps-3">Utilisateur</th>
                    <th className="fs-12 fw-600 border-0">Contact</th>
                    <th className="fs-12 fw-600 border-0">Rôle</th>
                    <th className="fs-12 fw-600 border-0">Statut</th>
                    <th className="fs-12 fw-600 border-0">Dernière connexion</th>
                    <th className="fs-12 fw-600 border-0 text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const rCfg = roleConfig[u.role] || { label:u.role, color:'#6b7280', bg:'#f3f4f6' };
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr key={u.id}>
                        <td className="ps-3 align-middle">
                          <div className="fw-600 fs-13">{u.firstname} {u.name}</div>
                          {isSelf && <div className="fs-11" style={{color:'#F97316'}}>Vous</div>}
                        </td>
                        <td className="align-middle">
                          <div className="fs-12">{u.email}</div>
                          <div className="fs-11 text-muted">{u.phone || '—'}</div>
                        </td>
                        <td className="align-middle">
                          <span className="badge" style={{background:rCfg.bg,color:rCfg.color,border:`1px solid ${rCfg.color}30`,fontSize:11}}>
                            {rCfg.label}
                          </span>
                        </td>
                        <td className="align-middle">
                          <span className="badge" style={{
                            background: u.is_active ? '#f0fdf4' : '#fef2f2',
                            color:      u.is_active ? '#16a34a' : '#dc2626',
                            fontSize:11
                          }}>
                            {u.is_active ? 'Actif' : 'Désactivé'}
                          </span>
                        </td>
                        <td className="align-middle fs-12 text-muted">{fmtDate(u.last_login_at)}</td>
                        <td className="align-middle text-end pe-3">
                          <div className="d-flex gap-1 justify-content-end">
                            <button className="btn btn-sm" title="Modifier" disabled={isSelf}
                              onClick={() => openEdit(u)}
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:12,opacity:isSelf?0.4:1}}>
                              <i className="ti ti-edit"/>
                            </button>
                            <button className="btn btn-sm" title="Mot de passe" disabled={isSelf}
                              onClick={() => openPassword(u)}
                              style={{background:'#f3f4f6',border:'none',borderRadius:6,fontSize:12,opacity:isSelf?0.4:1}}>
                              <i className="ti ti-key"/>
                            </button>
                            <button className="btn btn-sm" title={u.is_active ? 'Désactiver' : 'Activer'} disabled={isSelf || togglingId === u.id}
                              onClick={() => toggleActive(u)}
                              style={{background: u.is_active ? '#fff7ed' : '#f0fdf4', color: u.is_active ? '#EA580C' : '#16a34a', border:'none',borderRadius:6,fontSize:12,opacity:isSelf?0.4:1}}>
                              {togglingId === u.id ? <span className="spinner-border spinner-border-sm"/> : <i className={`ti ${u.is_active ? 'ti-lock' : 'ti-lock-open'}`}/>}
                            </button>
                            <button className="btn btn-sm" title="Supprimer" disabled={isSelf}
                              onClick={() => setDeleteTarget(u)}
                              style={{background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,opacity:isSelf?0.4:1}}>
                              <i className="ti ti-trash"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal création / édition */}
      {showForm && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-user-cog me-2" style={{color:'#F97316'}}/>
                  {editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
                </h5>
                <button className="btn-close" onClick={() => setShowForm(false)}/>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Nom <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" required
                        value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label fs-13 fw-600">Prénom <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" required
                        value={form.firstname} onChange={e => setForm(f=>({...f,firstname:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Email <span className="text-danger">*</span></label>
                    <input type="email" className="form-control" required disabled={!!editing}
                      value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                    {editing && <div className="fs-11 text-muted mt-1">L'email ne peut pas être modifié.</div>}
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Téléphone</label>
                    <input type="text" className="form-control"
                      value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  {!editing && (
                    <div className="mb-3">
                      <label className="form-label fs-13 fw-600">Mot de passe <span className="text-danger">*</span></label>
                      <input type="password" className="form-control" required minLength={8}
                        value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))}
                        style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                      <div className="fs-11 text-muted mt-1">Minimum 8 caractères.</div>
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="form-label fs-13 fw-600">Rôle <span className="text-danger">*</span></label>
                    <select className="form-select" required
                      value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value as UserItem['role']}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}>
                      {allowedRoles.map(r => (
                        <option key={r} value={r}>{roleConfig[r].label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4"
                    style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                    onClick={() => setShowForm(false)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={saving}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {saving ? <span className="spinner-border spinner-border-sm"/> : (editing ? 'Enregistrer' : 'Créer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal mot de passe */}
      {pwdTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700">
                  <i className="ti ti-key me-2" style={{color:'#F97316'}}/>
                  Changer le mot de passe
                </h5>
                <button className="btn-close" onClick={() => setPwdTarget(null)}/>
              </div>
              <form onSubmit={submitPassword}>
                <div className="modal-body">
                  <p className="fs-13 text-muted mb-3">
                    {pwdTarget.firstname} {pwdTarget.name} — l'utilisateur devra se reconnecter.
                  </p>
                  {error && (
                    <div className="alert mb-3" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626',fontSize:13}}>
                      <i className="ti ti-alert-circle me-2"/>{error}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Nouveau mot de passe <span className="text-danger">*</span></label>
                    <input type="password" className="form-control" required minLength={8}
                      value={pwdForm.password} onChange={e => setPwdForm(f=>({...f,password:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13 fw-600">Confirmer <span className="text-danger">*</span></label>
                    <input type="password" className="form-control" required minLength={8}
                      value={pwdForm.password_confirmation} onChange={e => setPwdForm(f=>({...f,password_confirmation:e.target.value}))}
                      style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  </div>
                </div>
                <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                  <button type="button" className="btn btn-sm px-4"
                    style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                    onClick={() => setPwdTarget(null)}>Annuler</button>
                  <button type="submit" className="btn btn-sm px-4" disabled={pwdSaving}
                    style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                    {pwdSaving ? <span className="spinner-border spinner-border-sm"/> : 'Confirmer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {deleteTarget && (
        <div className="modal show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content" style={{borderRadius:12,border:'none'}}>
              <div className="modal-header" style={{borderBottom:'1px solid #e5e7eb'}}>
                <h5 className="modal-title fw-700" style={{color:'#dc2626'}}>
                  <i className="ti ti-alert-triangle me-2"/>Supprimer l'utilisateur
                </h5>
                <button className="btn-close" onClick={() => setDeleteTarget(null)}/>
              </div>
              <div className="modal-body">
                <p className="fs-14">
                  Êtes-vous sûr de vouloir supprimer <strong>{deleteTarget.firstname} {deleteTarget.name}</strong> ?
                  Cette action est irréversible.
                </p>
              </div>
              <div className="modal-footer" style={{borderTop:'1px solid #e5e7eb'}}>
                <button className="btn btn-sm px-4"
                  style={{background:'#f3f4f6',border:'none',borderRadius:8}}
                  onClick={() => setDeleteTarget(null)}>Annuler</button>
                <button className="btn btn-sm px-4" disabled={deleting}
                  onClick={confirmDelete}
                  style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>
                  {deleting ? <span className="spinner-border spinner-border-sm"/> : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
