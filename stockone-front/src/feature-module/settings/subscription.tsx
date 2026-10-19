import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../core/services/apiService';

interface SubscriptionStatus {
  status: 'trial' | 'active' | 'suspended' | 'closed';
  subscription_start: string | null;
  subscription_end: string | null;
  days_until_expiry: number;
  amount: number;
  paydunya_sandbox: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  trial:     { label:'Période d\'essai', color:'#d97706', bg:'#fffbeb' },
  active:    { label:'Active',           color:'#16a34a', bg:'#f0fdf4' },
  suspended: { label:'Suspendue',        color:'#dc2626', bg:'#fef2f2' },
  closed:    { label:'Fermée',           color:'#6b7280', bg:'#f3f4f6' },
};

const PENDING_TOKEN_KEY = 'paydunya_pending_token';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' F';
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : '—';

const Subscription: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [data,    setData]    = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [redirecting, setRedirecting] = useState(false); // appel /initiate en cours, avant redirection
  const [confirming,  setConfirming]  = useState(false); // retour de PayDunya, appel /confirm en cours

  // Token conserve localement au moment du clic "Payer" (voir handlePay).
  // Permet de proposer "Verifier mon paiement" meme si l'onglet a ete
  // ferme avant le retour automatique de PayDunya (donc sans ?token= dans
  // l'URL cette fois-ci).
  const [pendingToken, setPendingToken] = useState<string | null>(
    () => localStorage.getItem(PENDING_TOKEN_KEY)
  );

  useEffect(() => { load(); }, []);

  // Au retour de PayDunya, l'URL contient ?paydunya=return&token=xxx
  // (token ajoute automatiquement par PayDunya a notre return_url).
  // On confirme une seule fois, puis on nettoie l'URL pour qu'un simple
  // rechargement de page ne retente pas la meme confirmation.
  useEffect(() => {
    const paydunyaStatus = searchParams.get('paydunya');
    const token = searchParams.get('token');

    if (paydunyaStatus === 'cancelled') {
      setError('Paiement annulé.');
      setSearchParams({}, { replace: true });
      return;
    }

    if (paydunyaStatus === 'return' && token) {
      confirmPayment(token);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: SubscriptionStatus }>('/subscription');
      setData(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const confirmPayment = async (token: string) => {
    setConfirming(true);
    setError(null);
    try {
      await api.post('/subscription/paydunya/confirm', { token });
      setSuccess('Paiement confirmé — votre abonnement a été activé/prolongé.');
      localStorage.removeItem(PENDING_TOKEN_KEY);
      setPendingToken(null);
      load();
    } catch (e: any) {
      // Echec (ou simplement "pas encore paye") : on garde le token stocke,
      // l'utilisateur peut reessayer "Verifier mon paiement" plus tard.
      setError(e.message || "Le paiement n'a pas pu être confirmé. Si le montant a été débité, contactez le support.");
    } finally {
      setConfirming(false);
    }
  };

  const handlePay = async () => {
    setError(null);
    setRedirecting(true);
    try {
      const res = await api.post<{ data: { checkout_url: string; token: string } }>('/subscription/paydunya/initiate');
      // Conserve le token AVANT de quitter la page : si l'onglet se ferme
      // ou que la redirection automatique de retour echoue, "Verifier mon
      // paiement" pourra quand meme confirmer avec ce token, sans en
      // dependre venant de l'URL.
      localStorage.setItem(PENDING_TOKEN_KEY, res.data.token);
      window.location.href = res.data.checkout_url;
      // Pas de finally ici : la page quitte l'application, inutile de
      // repasser redirecting a false avant le changement de page.
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la préparation du paiement.');
      setRedirecting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>;
  }

  if (error && !data) {
    return (
      <div className="alert" style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
        <i className="ti ti-alert-circle me-2"/>{error}
      </div>
    );
  }

  if (!data) return null;
  const st = statusConfig[data.status] || { label:data.status, color:'#6b7280', bg:'#f3f4f6' };
  // CORRECTIF : ne se declenchait que pour 'active' — un essai gratuit
  // n'affichait jamais ce bandeau, meme a quelques heures de la coupure.
  const isExpiringSoon = (data.status === 'active' || data.status === 'trial') && data.days_until_expiry <= 7;

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Abonnement</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Boutique</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Abonnement</li>
          </ol>
        </div>
      </div>

      {confirming && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#ecfeff',border:'1px solid #a5f3fc',borderRadius:8,color:'#0891b2'}}>
          <span className="spinner-border spinner-border-sm"/>Confirmation du paiement en cours...
        </div>
      )}
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

      {data.paydunya_sandbox && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#ecfeff',border:'1px solid #a5f3fc',borderRadius:8,color:'#0891b2',fontSize:13}}>
          <i className="ti ti-flask"/>Mode test (sandbox) activé — aucun paiement réel ne sera prélevé.
        </div>
      )}

      <div className="row g-3">
        <div className="col-xl-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <h6 className="fw-700 mb-0">Statut actuel</h6>
                <span className="badge" style={{background:st.bg,color:st.color,border:`1px solid ${st.color}30`,fontSize:12,padding:'6px 12px'}}>
                  {st.label}
                </span>
              </div>

              {isExpiringSoon && (
                <div className="alert mb-3 d-flex align-items-center gap-2"
                  style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,color:'#d97706',fontSize:13}}>
                  <i className="ti ti-calendar-exclamation"/>
                  Expire dans {data.days_until_expiry} jour{data.days_until_expiry > 1 ? 's' : ''}
                </div>
              )}

              <div className="mb-2">
                <div className="fs-11 text-muted">Début de la période en cours</div>
                <div className="fs-14 fw-600">{fmtDate(data.subscription_start)}</div>
              </div>
              <div className="mb-3">
                <div className="fs-11 text-muted">Expire le</div>
                <div className="fs-14 fw-600">{fmtDate(data.subscription_end)}</div>
              </div>

              <div className="p-3 rounded-3 mb-3" style={{background:'#fff7ed',border:'1px solid #FED7AA'}}>
                <div className="fs-12 text-muted mb-1">Prix de l'abonnement (12 mois)</div>
                <div className="fs-22 fw-800" style={{color:'#F97316'}}>{fmt(data.amount)}</div>
              </div>

              <button className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                disabled={redirecting || confirming}
                onClick={handlePay}
                style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'12px',fontWeight:700}}>
                {redirecting ? (
                  <><span className="spinner-border spinner-border-sm"/>Redirection vers PayDunya...</>
                ) : (
                  <><i className="ti ti-device-mobile fs-18"/>Payer via Mobile Money / Carte</>
                )}
              </button>
              <p className="fs-11 text-muted text-center mt-2 mb-0">
                Paiement sécurisé via PayDunya — Mobile Money (MTN, Moov) ou carte bancaire
              </p>

              {pendingToken && (
                <div className="mt-3 p-3 rounded-3" style={{background:'#ecfeff',border:'1px solid #a5f3fc'}}>
                  <p className="fs-12 mb-2" style={{color:'#0891b2'}}>
                    Un paiement a été lancé mais pas encore confirmé ici (onglet fermé trop tôt ?).
                  </p>
                  <button className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                    disabled={confirming || redirecting}
                    onClick={() => confirmPayment(pendingToken)}
                    style={{background:'#fff',color:'#0891b2',border:'1px solid #a5f3fc',borderRadius:8,padding:'8px',fontWeight:600}}>
                    {confirming ? (
                      <><span className="spinner-border spinner-border-sm"/>Vérification...</>
                    ) : (
                      <><i className="ti ti-refresh fs-16"/>Vérifier mon paiement</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="fw-700 mb-3">Comment ça marche ?</h6>
              <div className="d-flex gap-3 mb-3">
                <div style={{width:32,height:32,borderRadius:'50%',background:'#fff7ed',color:'#F97316',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontWeight:700,fontSize:13}}>1</div>
                <div>
                  <div className="fw-600 fs-13">Cliquez sur "Payer"</div>
                  <div className="fs-12 text-muted">Vous êtes redirigé vers la page de paiement sécurisée PayDunya.</div>
                </div>
              </div>
              <div className="d-flex gap-3 mb-3">
                <div style={{width:32,height:32,borderRadius:'50%',background:'#fff7ed',color:'#F97316',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontWeight:700,fontSize:13}}>2</div>
                <div>
                  <div className="fw-600 fs-13">Payez via Mobile Money ou carte</div>
                  <div className="fs-12 text-muted">MTN Mobile Money, Moov Money ou carte bancaire — validez avec votre code PIN.</div>
                </div>
              </div>
              <div className="d-flex gap-3">
                <div style={{width:32,height:32,borderRadius:'50%',background:'#f0fdf4',color:'#16a34a',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontWeight:700,fontSize:13}}>3</div>
                <div>
                  <div className="fw-600 fs-13">Abonnement activé automatiquement</div>
                  <div className="fs-12 text-muted">Vous êtes ramené automatiquement ici, et votre boutique reste (ou redevient) active pour 12 mois supplémentaires.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
