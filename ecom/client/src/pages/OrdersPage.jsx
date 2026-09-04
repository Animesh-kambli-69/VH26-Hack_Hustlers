import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { formatDate, formatPrice, getCustomerId } from '../utils.js';

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getOrders(getCustomerId())
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, []);

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
      {orders.map((order) => (
        <div className="order-card" key={order.id}>
          <div className="order-head">
            <div className="order-head-left">
              <span className="order-id">{order.id}</span>
              <span className="order-date">{formatDate(order.createdAt)}</span>
            </div>
            <span className="status-badge">{order.status}</span>
          </div>
          <div className="order-items">
            {order.items.map((item) => (
              <div className="order-line" key={item.productId}>
                <span>
                  {item.name} × {item.qty}
                </span>
                <strong>{formatPrice(item.price * item.qty)}</strong>
              </div>
            ))}
          </div>
          <div className="order-total">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      ))}
    </>
  );
}
