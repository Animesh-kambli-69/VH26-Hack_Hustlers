import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function WishlistPage() {
  const { ids } = useWishlist();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProducts()
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wished = (products || []).filter((p) => ids.includes(p.id));

  if (error) {
    return (
      <div className="empty-state">
        <div className="emoji">⚠️</div>
        <h2>Couldn't load your wishlist</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!products) {
    return (
      <div className="page-loader">
        <span className="spinner" />
        Loading your wishlist…
      </div>
    );
  }

  if (ids.length === 0 || wished.length === 0) {
    return (
      <div className="empty-state">
        <div className="emoji">💜</div>
        <h2>Your wishlist is empty</h2>
        <p>Tap the heart on any product to save it here for later.</p>
        <Link className="btn btn-primary" to="/">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-head-row">
        <h1 className="page-title">My wishlist</h1>
        <span className="result-count count-inline">
          {wished.length} saved {wished.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="product-grid">
        {wished.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}
