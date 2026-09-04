import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import QuantityPicker from '../components/QuantityPicker.jsx';
import { formatPrice } from '../utils.js';

export default function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="emoji">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added anything yet.</p>
        <Link className="btn btn-primary" to="/">
          Start shopping
        </Link>
      </div>
    );
  }

  const shipping = subtotal >= 75 ? 0 : 6.99;

  return (
    <div className="cart-layout">
      <div>
        <h1 className="page-title">Your cart</h1>
        <div className="cart-items">
          {items.map((item) => (
            <div className="cart-item" key={item.productId}>
              <Link to={`/products/${item.productId}`}>
                <img src={item.image} alt={item.name} />
              </Link>
              <div>
                <Link to={`/products/${item.productId}`} className="cart-item-name">
                  {item.name}
                </Link>
                <div className="cart-item-price">{formatPrice(item.price)} each</div>
              </div>
              <div className="cart-item-actions">
                <QuantityPicker value={item.qty} onChange={(q) => setQty(item.productId, q)} />
                <span className="cart-item-total">{formatPrice(item.price * item.qty)}</span>
                <button className="btn-danger-ghost" onClick={() => remove(item.productId)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="summary-card">
        <h2 className="summary-title">Order summary</h2>
        <div className="summary-row">
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
        <Link to="/checkout" className="btn btn-primary">
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
}
