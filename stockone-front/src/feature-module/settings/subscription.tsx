import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../core/services/apiService';

interface SubscriptionStatus {
  status: 'trial' | 'active' | 'suspended' | 'closed';
  subscription_start: string | null;
  subscription_end: string | null;
  days_until_expiry: number;
  amount: number;
  kkiapay_public_key: string;
  kkiapay_sandbox: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  trial:     { label:'Période d\'essai', color:'#d97706', bg:'#fffbeb' },
  active:    { label:'Active',           color:'#16a34a', bg:'#f0fdf4' },
  suspended: { label:'Suspendue',        color:'#dc2626', bg:'#fef2f2' },
  closed:    { label:'Fermée',           color:'#6b7280', bg:'#f3f4f6' },
};

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' F';
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : '—';

// Le SDK Kkiapay injecte ces fonctions globalement une fois le script chargé.
declare global {
  interface Window {
    openKkiapayWidget?: (config: Record<string, unknown>) => void;
    addSuccessListener?: (cb: (response: any) => void) => void;
    addFailedListener?: (cb: (error: any) => void) => void;
    removeSuccessListener?: (cb: (response: any) => void) => void;
  }
}

const KKIAPAY_SCRIPT_ID = 'kkiapay-sdk-script';
const KKIAPAY_SCRIPT_SRC = 'https://cdn.kkiapay.me/k.js';

const Subscription: React.FC = () => {
  const [data,    setData]    = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [sdkReady,  setSdkReady]  = useState(false);
  const [paying,    setPaying]    = useState(false); // widget ouvert, en attente du callback
  const [confirming,setConfirming]= useState(false); // appel /confirm en cours

  // Référence de l'intention de paiement en cours — stockée en ref pour rester
  // accessible depuis le callback Kkiapay (fermeture stable, pas de re-render).
  const intentReferenceRef = useRef<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: SubscriptionStatus }>('/subscription');
      setData(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // Charge le script Kkiapay une seule fois, à la demande
  const ensureSdkLoaded = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.openKkiapayWidget) { setSdkReady(true); resolve(); return; }
      const existing = document.getElementById(KKIAPAY_SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', () => { setSdkReady(true); resolve(); });
        return;
      }
      const script = document.createElement('script');
      script.id = KKIAPAY_SCRIPT_ID;
      script.src = KKIAPAY_SCRIPT_SRC;
      script.async = true;
      script.onload = () => { setSdkReady(true); resolve(); };
      script.onerror = () => reject(new Error('Impossible de charger le SDK Kkiapay. Vérifiez votre connexion.'));
      document.body.appendChild(script);
    });
  }, []);

  const handleSuccess = useCallback(async (response: any) => {
    const transactionId = response?.transactionId;
    const intentReference = intentReferenceRef.current;

    if (!transactionId) {
      setError('Réponse Kkiapay invalide (transaction introuvable).');
      setPaying(false);
      return;
    }
    if (!intentReference) {
      setError("Session de paiement perdue — merci de relancer le paiement depuis le début.");
      setPaying(false);
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      await api.post('/subscription/kkiapay/confirm', {
        transaction_id: transactionId,
        intent_reference: intentReference,
      });
      setSuccess('Paiement confirmé — votre abonnement a été activé/prolongé.');
      load();
    } catch (e: any) {
      setError(e.message || "Le paiement a été reçu mais la confirmation a échoué. Contactez le support avec l'ID de transaction : " + transactionId);
    } finally {
      setConfirming(false);
      setPaying(false);
      intentReferenceRef.current = null;
    }
  }, []);

  const handlePay = async () => {
    if (!data) return;
    setError(null);
    setPaying(true);
    try {
      // Étape 1 : demander une intention de paiement liée à la boutique AVANT
      // d'ouvrir le widget — c'est ce qui empêche la réutilisation de la
      // transaction d'une autre boutique lors de la confirmation.
      const intentRes = await api.post<{ data: { intent_reference: string } }>('/subscription/kkiapay/initiate');
      intentReferenceRef.current = intentRes.data.intent_reference;

      await ensureSdkLoaded();

      // On (re)branche le listener à chaque paiement pour capturer la bonne réponse
      window.addSuccessListener?.(handleSuccess);
      window.addFailedListener?.((err: any) => {
        setError('Le paiement a échoué ou a été annulé.');
        setPaying(false);
      });

      window.openKkiapayWidget?.({
        amount: data.amount,
        key: data.kkiapay_public_key,
        sandbox: data.kkiapay_sandbox,
        position: 'center',
        theme: '#F97316',
        data: intentReferenceRef.current,
      });
    } catch (e: any) {
      setError(e.message || 'Erreur lors du chargement du paiement.');
      setPaying(false);
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
  const isExpiringSoon = data.status === 'active' && data.days_until_expiry <= 7;

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

      {data.kkiapay_sandbox && (
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
                <div className="fs-12 text-muted mb-1">Prix de l'abonnement (30 jours)</div>
                <div className="fs-22 fw-800" style={{color:'#F97316'}}>{fmt(data.amount)}</div>
              </div>

              <button className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                disabled={paying || confirming}
                onClick={handlePay}
                style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'12px',fontWeight:700}}>
                {confirming ? (
                  <><span className="spinner-border spinner-border-sm"/>Confirmation du paiement...</>
                ) : paying ? (
                  <><span className="spinner-border spinner-border-sm"/>Paiement en cours...</>
                ) : (
                  <><i className="ti ti-device-mobile fs-18"/>Payer via Mobile Money / Carte</>
                )}
              </button>
              <p className="fs-11 text-muted text-center mt-2 mb-0">
                Paiement sécurisé via Kkiapay — Mobile Money (MTN, Moov) ou carte bancaire
              </p>
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
                  <div className="fs-12 text-muted">Une fenêtre sécurisée Kkiapay s'ouvre pour choisir votre mode de paiement.</div>
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
                  <div className="fs-12 text-muted">Dès confirmation du paiement, votre boutique reste (ou redevient) active pour 30 jours supplémentaires.</div>
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
