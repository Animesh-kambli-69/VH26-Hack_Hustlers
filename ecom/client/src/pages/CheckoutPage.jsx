import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice, getCustomerId } from '../utils.js';

// Display-only copy — every number is recomputed server-side by the quote
// endpoint and again at order creation. Shipping options mirror the backend.
const SHIPPING_OPTIONS = [
  { id: 'standard', label: '🚚 Standard', desc: '5–7 business days · free over $75, else $6.99' },
  { id: 'express', label: '⚡ Express', desc: '2–3 business days · $12.99 flat' },
];

const PAYMENTS = [
  { id: 'card', label: '💳 Card' },
  { id: 'upi', label: '📱 UPI' },
  { id: 'cod', label: '💵 Cash on delivery' },
];

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    payment: 'card',
  });
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const requestedQuote = useRef('');

  // Ask the server for an accurate total whenever the cart, shipping method
  // or applied promo code changes.
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    const payload = {
      items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      shippingMethod,
      promoCode: appliedPromo || undefined,
    };
    requestedQuote.current = shippingMethod + (appliedPromo || '');
    api
      .quoteOrder(payload)
      .then((q) => {
        if (!cancelled) {
          setQuote(q);
          setQuoteError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQuoteError(err.message);
          setQuote(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [items, shippingMethod, appliedPromo]);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="emoji">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Add a few products before checking out.</p>
        <Link className="btn btn-primary" to="/">
          Browse products
        </Link>
      </div>
    );
  }

  const quoted = quote && requestedQuote.current === shippingMethod + (appliedPromo || '');
  const summary = quoted
    ? quote
    : { subtotal, discount: 0, shipping: 0, total: subtotal, deliveryEstimate: null };

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setAppliedPromo(code);
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createOrder({
        customerId: getCustomerId(),
        customer: form,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        shippingMethod,
        promoCode: appliedPromo || undefined,
      });
      clear();
      navigate(`/order-success/${res.order.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const standardFee = subtotal >= 75 ? 0 : 6.99;

  return (
    <div className="checkout-layout">
      <form className="form-card" onSubmit={onSubmit}>
        <h2>Shipping details</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="name">Full name</label>
            <input id="name" required value={form.name} onChange={update('name')} placeholder="Priya Sharma" />
          </div>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={form.email} onChange={update('email')} placeholder="priya@example.com" />
          </div>
          <div className="form-field full">
            <label htmlFor="address">Address</label>
            <input id="address" required value={form.address} onChange={update('address')} placeholder="42 Marine Drive" />
          </div>
          <div className="form-field">
            <label htmlFor="city">City</label>
            <input id="city" required value={form.city} onChange={update('city')} placeholder="Mumbai" />
          </div>
          <div className="form-field">
            <label htmlFor="state">State</label>
            <input id="state" required value={form.state} onChange={update('state')} placeholder="Maharashtra" />
          </div>
          <div className="form-field">
            <label htmlFor="pincode">Pincode</label>
            <input id="pincode" required inputMode="numeric" value={form.pincode} onChange={update('pincode')} placeholder="400001" />
          </div>
        </div>

        <h2 className="section-subtitle">Delivery speed</h2>
        <div className="radio-row">
          {SHIPPING_OPTIONS.map((m) => {
            const fee = m.id === 'standard' ? standardFee : 12.99;
            return (
              <label
                key={m.id}
                className={`radio-option ${shippingMethod === m.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={m.id}
                  checked={shippingMethod === m.id}
                  onChange={() => setShippingMethod(m.id)}
                />
                <span className="ship-option">
                  <strong>{m.label}</strong>
                  <small>
                    {m.desc} · {fee === 0 ? 'Free' : formatPrice(fee)}
                  </small>
                </span>
              </label>
            );
          })}
        </div>

        <h2 className="section-subtitle">Promo code</h2>
        <div className="promo-row">
          <input
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="e.g. SAVE10"
            aria-label="Promo code"
          />
          {appliedPromo ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={removePromo}>
              Remove
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={applyPromo} disabled={!promoInput.trim()}>
              Apply
            </button>
          )}
        </div>
        {appliedPromo && quoted && quote.promoError && (
          <p className="promo-feedback promo-error">{quote.promoError}</p>
        )}
        {appliedPromo && quoted && quote.promoCode && !quote.promoError && (
          <p className="promo-feedback promo-ok">
            ✓ {quote.promoLabel} applied — you save {formatPrice(quote.discount)}
          </p>
        )}
        {!appliedPromo && (
          <p className="promo-hint">Try <strong>SAVE10</strong> (10% off), <strong>FLAT5</strong> ($5 off $25+) or <strong>FREESHIP</strong>.</p>
        )}

        <h2 className="section-subtitle">Payment method</h2>
        <div className="radio-row">
          {PAYMENTS.map((p) => (
            <label key={p.id} className={`radio-option ${form.payment === p.id ? 'selected' : ''}`}>
              <input
                type="radio"
                name="payment"
                value={p.id}
                checked={form.payment === p.id}
                onChange={update('payment')}
              />
              {p.label}
            </label>
          ))}
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !quoted || (appliedPromo && quote.promoError)}>
          {submitting ? 'Placing order…' : `Place order — ${formatPrice(summary.total)}`}
        </button>
      </form>

      <aside className="summary-card">
        <h2 className="summary-title">Your items</h2>
        <div className="order-items">
          {items.map((item) => (
            <div className="order-line" key={item.productId}>
              <span>
                {item.name} × {item.qty}
              </span>
              <strong>{formatPrice(item.price * item.qty)}</strong>
            </div>
          ))}
        </div>
        <div className="summary-row summary-spaced">
          <span>Subtotal</span>
          <span>{formatPrice(summary.subtotal)}</span>
        </div>
        {summary.discount > 0 && (
          <div className="summary-row discount">
            <span>Promo {summary.promoCode ? `(${summary.promoCode})` : ''}</span>
            <span>−{formatPrice(summary.discount)}</span>
          </div>
        )}
        <div className="summary-row">
          <span>Shipping ({shippingMethod})</span>
          <span>{quoted ? (summary.shipping === 0 ? 'Free' : formatPrice(summary.shipping)) : '…'}</span>
        </div>
        <div className="summary-row">
          <span>Estimated delivery</span>
          <span>{quoted && summary.deliveryEstimate ? `by ${summary.deliveryEstimate}` : '…'}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>{quoted ? formatPrice(summary.total) : '…'}</span>
        </div>
        <p className="summary-note">Prices are confirmed on the server when you place the order.</p>
      </aside>
    </div>
  );
}
