import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';

interface ProductUnit {
  id: number;
  level: number;
  label: string;
  stock_qty: number;
  price_wholesale: string;
  price_detail: string;
  price_extra: string;
  is_sellable: boolean;
}

interface Product {
  id: number;
  name: string;
  reference: string | null;
  category: { name: string } | null;
  units: ProductUnit[];
}

interface Client {
  id: number;
  name: string;
  firstname: string;
  phone: string;
}

interface CartItem {
  key: string;
  product_unit_id: number;
  product_name: string;
  unit_label: string;
  sale_type: 'gros' | 'detail' | 'extra';
  quantity: number;
  unit_price: number;
  stock_qty: number;
}

interface TodaySummary {
  nb_transactions: number;
  ca_total: number;
  encaissements: number;
  credits_accordes: number;
}

type PaymentMode = 'cash' | 'credit' | 'mobile_money' | 'mixed';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';

const Pos: React.FC = () => {
  const navigate = useNavigate();

  const [products,   setProducts]   = useState<Product[]>([]);
  const [loadingProd,setLoadingProd]= useState(true);
  const [search,      setSearch]     = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults,setClientResults]= useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [, setSearchingClient] = useState(false);

  const [paymentMode,   setPaymentMode]   = useState<PaymentMode>('cash');
  const [amountPaid,    setAmountPaid]    = useState('');
  const [discountAmount,setDiscountAmount]= useState('0');
  const [notes,         setNotes]         = useState('');

  const [extraIdentity, setExtraIdentity] = useState({ name:'', firstname:'', phone:'', remarks:'' });

  const [summary,  setSummary]  = useState<TodaySummary | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [submitting,setSubmitting] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);

  useEffect(() => { loadProducts(); loadSummary(); }, []);

  const loadProducts = async () => {
    try {
      setLoadingProd(true);
      const res = await api.get<{ data: Product[] }>('/products');
      setProducts(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingProd(false); }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get<{ data: TodaySummary }>('/sales/summary/today');
      setSummary(res.data);
    } catch { /* silencieux, non bloquant */ }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference || '').toLowerCase().includes(search.toLowerCase())
  );

  const searchClients = async (q: string) => {
    setClientSearch(q);
    if (q.length < 2) { setClientResults([]); return; }
    setSearchingClient(true);
    try {
      const res = await api.get<{ data: Client[] }>('/clients', { search: q });
      setClientResults(res.data);
    } catch { /* silencieux */ }
    finally { setSearchingClient(false); }
  };

  const addToCart = (product: Product, unit: ProductUnit, saleType: CartItem['sale_type']) => {
    const key = `${unit.id}-${saleType}-${Date.now()}`;
    const defaultPrice = saleType === 'extra' ? Number(unit.price_extra) : saleType === 'detail' ? Number(unit.price_detail) : Number(unit.price_wholesale);
    setCart(prev => [...prev, {
      key, product_unit_id: unit.id, product_name: product.name, unit_label: unit.label,
      sale_type: saleType, quantity: 1, unit_price: defaultPrice, stock_qty: unit.stock_qty,
    }]);
  };

  const updateCartItem = (key: string, patch: Partial<CartItem>) => {
    setCart(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));
  };

  const removeFromCart = (key: string) => setCart(prev => prev.filter(i => i.key !== key));

  const totalAmount    = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discount        = Number(discountAmount) || 0;
  const netAmount        = Math.max(0, totalAmount - discount);
  const hasExtra          = cart.some(i => i.sale_type === 'extra');

  useEffect(() => {
    if (paymentMode === 'cash') setAmountPaid(String(netAmount));
  }, [netAmount, paymentMode]);

  const resetSale = () => {
    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
    setClientResults([]);
    setPaymentMode('cash');
    setAmountPaid('');
    setDiscountAmount('0');
    setNotes('');
    setExtraIdentity({ name:'', firstname:'', phone:'', remarks:'' });
  };

  const handleSubmit = async () => {
    setError(null);
    if (cart.length === 0) { setError('Le panier est vide.'); return; }
    for (const item of cart) {
      if (item.quantity > item.stock_qty) {
        setError(`Stock insuffisant pour ${item.product_name} (${item.unit_label}). Disponible : ${item.stock_qty}.`);
        return;
      }
    }
    if (hasExtra && (!extraIdentity.name || !extraIdentity.firstname || !extraIdentity.phone)) {
      setError('IdentitÃ© acheteur (nom, prÃ©nom, tÃ©lÃ©phone) requise pour une vente Extra.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        client_id: selectedClient?.id,
        payment_mode: paymentMode,
        amount_paid: Number(amountPaid) || 0,
        discount_amount: discount,
        notes: notes || undefined,
        items: cart.map(i => ({
          product_unit_id: i.product_unit_id,
          sale_type: i.sale_type,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      };
      if (hasExtra) payload.extra_identity = extraIdentity;

      const res = await api.post<{ data: any }>('/sales', payload);
      setSuccess(`Vente enregistrÃ©e : ${res.data.invoice_number}`);
      setLastSaleId(res.data.id);
      resetSale();
      loadProducts();
      loadSummary();
      setTimeout(() => setSuccess(null), 6000);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'enregistrement de la vente.");
    } finally {
      setSubmitting(false);
    }
  };

  const saleTypeLabel = (t: string) => t === 'gros' ? 'Gros' : t === 'detail' ? 'DÃ©tail' : 'Extra';
  const saleTypeColor = (t: string) => t === 'gros' ? '#7c3aed' : t === 'detail' ? '#0891b2' : '#F97316';

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title">Caisse POS</h4>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item fs-13 text-muted">Ventes</li>
            <li className="breadcrumb-item fs-13 active" style={{color:'#F97316'}}>Caisse</li>
          </ol>
        </div>
        {summary && (
          <div className="d-flex gap-3">
            <div className="text-end">
              <div className="fs-11 text-muted">Transactions aujourd'hui</div>
              <div className="fw-700 fs-14">{summary.nb_transactions}</div>
            </div>
            <div className="text-end">
              <div className="fs-11 text-muted">CA du jour</div>
              <div className="fw-700 fs-14" style={{color:'#F97316'}}>{fmt(summary.ca_total)}</div>
            </div>
          </div>
        )}
      </div>

      {success && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,color:'#16a34a'}}>
          <i className="ti ti-circle-check"/>{success}
          {lastSaleId && (
            <div className="ms-auto d-flex gap-2">
              <a href={`${(api as any).API_BASE_URL || ''}`} onClick={e => e.preventDefault()} className="d-none"/>
              <button className="btn btn-sm" onClick={() => navigate(all_routes.salesList)}
                style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:6,fontSize:12}}>
                Voir la vente
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="alert mb-3 d-flex align-items-center gap-2"
          style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,color:'#dc2626'}}>
          <i className="ti ti-alert-circle"/>{error}
          <button className="btn-close ms-auto" onClick={() => setError(null)}/>
        </div>
      )}

      <div className="row g-3">
        {/* Catalogue produits */}
        <div className="col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="position-relative mb-3">
                <input type="text" className="form-control" placeholder="Rechercher un produit..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{paddingLeft:40,borderColor:'#e5e7eb',borderRadius:8}}/>
                <i className="ti ti-search position-absolute"
                  style={{left:12,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}/>
              </div>

              {loadingProd ? (
                <div className="text-center py-5"><div className="spinner-border" style={{color:'#F97316'}} role="status"/></div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-5"><p className="text-muted">Aucun produit trouvÃ©</p></div>
              ) : (
                <div style={{maxHeight:560, overflowY:'auto'}}>
                  {filteredProducts.map(p => (
                    <div key={p.id} className="p-2 mb-2 rounded-3" style={{border:'1px solid #f3f4f6'}}>
                      <div className="fw-600 fs-13 mb-1">{p.name}</div>
                      <div className="d-flex flex-wrap gap-2">
                        {p.units.filter(u => u.is_sellable).map(u => (
                          <div key={u.id} className="d-flex align-items-center gap-1 p-1 rounded-2" style={{background:'#f8f9fa'}}>
                            <span className="fs-11 fw-600">{u.label}</span>
                            <span className="badge" style={{
                              background: u.stock_qty <= 0 ? '#fef2f2' : '#f0fdf4',
                              color:      u.stock_qty <= 0 ? '#dc2626' : '#16a34a',
                              fontSize:10
                            }}>
                              {u.stock_qty}
                            </span>
                            <button className="btn btn-sm" disabled={u.stock_qty <= 0}
                              onClick={() => addToCart(p, u, 'gros')}
                              title={`Ajouter (Gros â€” ${fmt(Number(u.price_wholesale))})`}
                              style={{background:'#f5f3ff',color:'#7c3aed',border:'none',borderRadius:4,fontSize:10,padding:'2px 6px'}}>
                              G
                            </button>
                            <button className="btn btn-sm" disabled={u.stock_qty <= 0}
                              onClick={() => addToCart(p, u, 'detail')}
                              title={`Ajouter (DÃ©tail â€” ${fmt(Number(u.price_detail))})`}
                              style={{background:'#ecfeff',color:'#0891b2',border:'none',borderRadius:4,fontSize:10,padding:'2px 6px'}}>
                              D
                            </button>
                            <button className="btn btn-sm" disabled={u.stock_qty <= 0}
                              onClick={() => addToCart(p, u, 'extra')}
                              title={`Ajouter (Extra â€” ${fmt(Number(u.price_extra))})`}
                              style={{background:'#fff7ed',color:'#F97316',border:'none',borderRadius:4,fontSize:10,padding:'2px 6px'}}>
                              E
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panier + paiement */}
        <div className="col-xl-5">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h6 className="fw-700 mb-3 d-flex align-items-center gap-2">
                <div style={{width:4,height:20,background:'#F97316',borderRadius:2}}/>
                Panier ({cart.length})
              </h6>

              {cart.length === 0 ? (
                <div className="text-center py-4">
                  <i className="ti ti-shopping-cart d-block mb-2" style={{fontSize:36,color:'#d1d5db'}}/>
                  <p className="text-muted fs-13">Ajoutez des produits depuis le catalogue</p>
                </div>
              ) : (
                <div style={{maxHeight:280, overflowY:'auto'}}>
                  {cart.map(item => (
                    <div key={item.key} className="d-flex align-items-center gap-2 p-2 mb-2 rounded-3" style={{background:'#f8f9fa'}}>
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-600 fs-12">{item.product_name}</span>
                          <span className="badge" style={{background:`${saleTypeColor(item.sale_type)}15`,color:saleTypeColor(item.sale_type),fontSize:10}}>
                            {saleTypeLabel(item.sale_type)}
                          </span>
                        </div>
                        <div className="fs-11 text-muted">{item.unit_label}</div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <input type="number" min={1} max={item.stock_qty} value={item.quantity}
                            onChange={e => updateCartItem(item.key, { quantity: Math.max(1, Number(e.target.value)) })}
                            style={{width:50,fontSize:12,padding:'2px 4px',borderRadius:6,border:'1px solid #e5e7eb'}}/>
                          <span className="fs-11">Ã—</span>
                          <input type="number" min={0} value={item.unit_price}
                            onChange={e => updateCartItem(item.key, { unit_price: Number(e.target.value) })}
                            style={{width:80,fontSize:12,padding:'2px 4px',borderRadius:6,border:'1px solid #e5e7eb'}}/>
                          <span className="fs-12 fw-600 ms-auto">{fmt(item.unit_price * item.quantity)}</span>
                        </div>
                      </div>
                      <button className="btn btn-sm" onClick={() => removeFromCart(item.key)}
                        style={{background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:11}}>
                        <i className="ti ti-x"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {hasExtra && (
                <div className="p-2 mt-2 rounded-3" style={{background:'#fff7ed',border:'1px solid #FED7AA'}}>
                  <div className="fs-11 fw-600 mb-2" style={{color:'#F97316'}}>IdentitÃ© acheteur Extra (requis)</div>
                  <div className="row g-1 mb-1">
                    <div className="col-6">
                      <input className="form-control form-control-sm" placeholder="Nom"
                        value={extraIdentity.name} onChange={e => setExtraIdentity(f=>({...f,name:e.target.value}))}/>
                    </div>
                    <div className="col-6">
                      <input className="form-control form-control-sm" placeholder="PrÃ©nom"
                        value={extraIdentity.firstname} onChange={e => setExtraIdentity(f=>({...f,firstname:e.target.value}))}/>
                    </div>
                  </div>
                  <input className="form-control form-control-sm" placeholder="TÃ©lÃ©phone"
                    value={extraIdentity.phone} onChange={e => setExtraIdentity(f=>({...f,phone:e.target.value}))}/>
                </div>
              )}
            </div>
          </div>

          {/* Client */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h6 className="fw-700 mb-2 fs-13">Client (optionnel)</h6>
              {selectedClient ? (
                <div className="d-flex align-items-center gap-2 p-2 rounded-3" style={{background:'#fff7ed'}}>
                  <i className="ti ti-user" style={{color:'#F97316'}}/>
                  <span className="fs-13">{selectedClient.firstname} {selectedClient.name} â€” {selectedClient.phone}</span>
                  <button className="btn btn-sm ms-auto" onClick={() => setSelectedClient(null)}
                    style={{background:'transparent',border:'none',fontSize:12}}>
                    <i className="ti ti-x"/>
                  </button>
                </div>
              ) : (
                <div className="position-relative">
                  <input type="text" className="form-control form-control-sm" placeholder="Rechercher un client..."
                    value={clientSearch} onChange={e => searchClients(e.target.value)}
                    style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                  {clientResults.length > 0 && (
                    <div className="position-absolute w-100 mt-1" style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,zIndex:10,maxHeight:150,overflowY:'auto'}}>
                      {clientResults.map(c => (
                        <div key={c.id} className="p-2 fs-13" style={{cursor:'pointer'}}
                          onClick={() => { setSelectedClient(c); setClientResults([]); setClientSearch(''); }}>
                          {c.firstname} {c.name} â€” {c.phone}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Paiement */}
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h6 className="fw-700 mb-2 fs-13">Paiement</h6>
              <div className="mb-2">
                <select className="form-select form-select-sm" value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                  style={{borderColor:'#e5e7eb',borderRadius:8}}>
                  <option value="cash">EspÃ¨ces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="credit">CrÃ©dit</option>
                  <option value="mixed">Mixte (partiel + crÃ©dit)</option>
                </select>
              </div>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="fs-11 text-muted">Remise</label>
                  <input type="number" className="form-control form-control-sm" min={0} value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)} style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                </div>
                <div className="col-6">
                  <label className="fs-11 text-muted">Montant payÃ©</label>
                  <input type="number" className="form-control form-control-sm" min={0} value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    disabled={paymentMode === 'cash'}
                    style={{borderColor:'#e5e7eb',borderRadius:8}}/>
                </div>
              </div>
              <textarea className="form-control form-control-sm mb-3" rows={1} placeholder="Notes (optionnel)"
                value={notes} onChange={e => setNotes(e.target.value)} style={{borderColor:'#e5e7eb',borderRadius:8}}/>

              <div className="p-2 rounded-3 mb-3" style={{background:'#f8f9fa'}}>
                <div className="d-flex justify-content-between fs-13">
                  <span>Total</span><span>{fmt(totalAmount)}</span>
                </div>
                <div className="d-flex justify-content-between fs-13">
                  <span>Remise</span><span>-{fmt(discount)}</span>
                </div>
                <div className="d-flex justify-content-between fw-700 fs-15 pt-1 mt-1" style={{borderTop:'1px solid #e5e7eb'}}>
                  <span>Net Ã  payer</span><span style={{color:'#F97316'}}>{fmt(netAmount)}</span>
                </div>
              </div>

              <button className="btn w-100" disabled={submitting || cart.length === 0} onClick={handleSubmit}
                style={{background:'#F97316',color:'#fff',border:'none',borderRadius:8,padding:'12px',fontWeight:700}}>
                {submitting ? <><span className="spinner-border spinner-border-sm me-2"/>Enregistrement...</> : <><i className="ti ti-check me-2"/>Valider la vente</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pos;
