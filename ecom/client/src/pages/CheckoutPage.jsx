import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice, getCustomerId } from '../utils.js';

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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

  const shipping = subtotal >= 75 ? 0 : 6.99;
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createOrder({
        customerId: getCustomerId(),
        customer: form,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      });
      clear();
      navigate(`/order-success/${res.order.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

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

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Placing order…' : `Place order — ${formatPrice(subtotal + shipping)}`}
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
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Shipping</span>
          <span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatPrice(subtotal + shipping)}</span>
        </div>
      </aside>
    </div>
  );
}
