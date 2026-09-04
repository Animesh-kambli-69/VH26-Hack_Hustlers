import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { formatDate, formatPrice, getCustomerId } from '../utils.js';

const FLOW = [
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
];

function eventAt(order, status) {
  const ev = (order.events || []).find((e) => e.status === status);
  return ev ? ev.at : null;
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

// Small horizontal stepper: Confirmed → Shipped → Delivered. Cancelled orders
// render as a single terminal step instead.
function OrderTimeline({ order }) {
  if (order.status === 'cancelled') {
    const at = eventAt(order, 'cancelled');
    return (
      <div className="timeline timeline-cancelled">
        <div className="tl-step done cancelled">
          <span className="tl-dot" />
          <div>
            <span className="tl-label">Cancelled</span>
            {at && <span className="tl-date">{formatDate(at)}</span>}
          </div>
        </div>
        <p className="tl-note">Stock was returned to the catalog and your payment method was never charged.</p>
      </div>
    );
  }

  const reached = FLOW.findIndex((f) => f.id === order.status);

  return (
    <div className="timeline">
      {FLOW.map((f, i) => {
        const done = i <= reached;
        const at = eventAt(order, f.id);
        return (
          <div key={f.id} className={`tl-step ${done ? 'done' : ''}`}>
            <span className="tl-dot" />
            <div>
              <span className="tl-label">{f.label}</span>
              {done && at && <span className="tl-date">{formatDate(at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getOrders(getCustomerId())
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn) => {
    setBusy(true);
    setActionMsg(null);
    try {
      await fn();
      load();
    } catch (err) {
      setActionMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = (order) => {
    if (!window.confirm(`Cancel order ${order.id}? Items will be returned to stock.`)) return;
    act(() => api.cancelOrder(order.id));
  };

  if (error) {
    return (
      <div className="empty-state">
        <div className="emoji">⚠️</div>
        <h2>Couldn't load orders</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!orders) {
    return (
      <div className="page-loader">
        <span className="spinner" />
        Loading your orders…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <div className="emoji">📦</div>
        <h2>No orders yet</h2>
        <p>When you place an order, it will show up here.</p>
        <Link className="btn btn-primary" to="/">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">My orders</h1>
      {actionMsg && <div className="form-error">{actionMsg}</div>}
      {orders.map((order) => (
        <div className="order-card" key={order.id}>
          <div className="order-head">
            <div className="order-head-left">
              <span className="order-id">{order.id}</span>
              <span className="order-date">{formatDate(order.createdAt)}</span>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <OrderTimeline order={order} />

          <div className="order-items">
            {order.items.map((item) => (
              <div className="order-line" key={item.productId}>
                <span>
                  <Link to={`/products/${item.productId}`} className="inline-link">
                    {item.name}
                  </Link>{' '}
                  × {item.qty}
                </span>
                <strong>{formatPrice(item.price * item.qty)}</strong>
              </div>
            ))}
          </div>

          <div className="order-summary-rows">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="summary-row discount">
                <span>Promo {order.promoCode ? `(${order.promoCode})` : ''}</span>
                <span>−{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Shipping ({order.shippingMethod})</span>
              <span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span>
            </div>
            <div className="summary-row">
              <span>Estimated delivery</span>
              <span>{order.status === 'delivered' ? 'Delivered' : order.deliveryEstimate ? `by ${order.deliveryEstimate}` : '—'}</span>
            </div>
            <div className="order-total">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>

          {(order.status === 'confirmed' || order.status === 'shipped') && (
            <div className="order-actions">
              {order.status === 'confirmed' && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api.advanceOrder(order.id))}>
                  Demo: mark shipped
                </button>
              )}
              {order.status === 'shipped' && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api.advanceOrder(order.id))}>
                  Demo: mark delivered
                </button>
              )}
              {order.status === 'confirmed' && (
                <button className="btn-danger-ghost" disabled={busy} onClick={() => cancelOrder(order)}>
                  Cancel order
                </button>
              )}
              <span className="order-actions-note">Status actions are demo helpers.</span>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
