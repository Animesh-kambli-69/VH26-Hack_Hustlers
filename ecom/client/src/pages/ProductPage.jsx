import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import QuantityPicker from '../components/QuantityPicker.jsx';
import Stars from '../components/Stars.jsx';
import WishlistButton from '../components/WishlistButton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { formatPrice } from '../utils.js';

export default function ProductPage() {
  const { id } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProduct(null);
    setRelated([]);
    setError(null);
    setQty(1);
    api
      .getProduct(id)
      .then((data) => {
        if (cancelled) return;
        setProduct(data.product);
        api
          .getProducts({ category: data.product.category })
          .then((list) => {
            if (!cancelled) setRelated(list.filter((p) => p.id !== data.product.id).slice(0, 4));
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="empty-state">
        <div className="emoji">😕</div>
        <h2>Product not found</h2>
        <p>{error}</p>
        <Link className="btn btn-primary" to="/">
          Back to shop
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-loader">
        <span className="spinner" />
        Loading product…
      </div>
    );
  }

  const handleAdd = () => {
    add(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const stockClass =
    product.stock === 0 ? 'stock-out' : product.stock <= 20 ? 'stock-low' : 'stock-in';
  const stockLabel =
    product.stock === 0
      ? 'Out of stock'
      : product.stock <= 20
        ? `Only ${product.stock} left in stock`
        : 'In stock, ready to ship';

  return (
    <>
      <div className="product-layout">
        <div className="product-layout-media">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="product-layout-info">
          <span className="product-card-category">{product.category}</span>
          <h1>{product.name}</h1>
          <div className="product-card-rating">
            <Stars rating={product.rating} />
            <span>
              {product.rating} · {product.reviews} reviews
            </span>
          </div>
          <span className={`stock-line ${stockClass}`}>{stockLabel}</span>
          <span className="price">{formatPrice(product.price)}</span>
          <p className="product-desc">{product.description}</p>
          <div className="product-actions">
            <QuantityPicker value={qty} max={Math.max(product.stock, 1)} onChange={setQty} />
            <button className="btn btn-primary" disabled={product.stock === 0} onClick={handleAdd}>
              {added ? 'Added ✓' : 'Add to cart'}
            </button>
            <WishlistButton variant="text" productId={product.id} />
          </div>
          <div className="meta-row">
            <span>✓ Free shipping over $75</span>
            <span>✓ 30-day returns</span>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <>
          <h2 className="section-title">You might also like</h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
