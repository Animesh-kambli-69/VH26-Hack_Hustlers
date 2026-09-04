import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { formatPrice } from '../utils.js';

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getOrder(orderId)
      .then((d) => setOrder(d.order))
      .catch((err) => setError(err.message));
  }, [orderId]);

  if (error) {
    return (
      <div className="empty-state">
        <div className="emoji">😕</div>
        <h2>Order not found</h2>
        <p>{error}</p>
        <Link className="btn btn-primary" to="/">
          Back to shop
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-loader">
        <span className="spinner" />
        Loading your order…
      </div>
    );
  }

  const firstName = order.customer.name.split(' ')[0];

  return (
    <div className="success-card">
      <div className="success-icon">✓</div>
      <h1>Thank you, {firstName}!</h1>
      <p className="success-sub">Your order has been placed successfully.</p>
      <div className="order-chip">{order.id}</div>
      <div className="order-items success-items">
        {order.items.map((item) => (
          <div className="order-line" key={item.productId}>
            <span>
              {item.name} × {item.qty}
            </span>
            <strong>{formatPrice(item.price * item.qty)}</strong>
          </div>
        ))}
        <div className="order-total">
          <span>Total paid</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>
      <p className="success-sub">
        A confirmation was sent to {order.customer.email}.
        <br />
        Track it anytime under{' '}
        <Link to="/orders" className="inline-link">
          My orders
        </Link>
        .
      </p>
      <div className="success-actions">
        <Link className="btn btn-primary" to="/">
          Continue shopping
        </Link>
        <Link className="btn btn-ghost" to="/orders">
          View my orders
        </Link>
      </div>
    </div>
  );
}
