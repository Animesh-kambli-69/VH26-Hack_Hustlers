import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'featured';

  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProducts(null);
    setError(null);
    api
      .getProducts({ category, search, sort })
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [category, search, sort]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      {!search && (
        <>
        <section className="hero">
          <h1>Everything you need, delivered fast.</h1>
          <p>
            Shop electronics, fashion, home goods and more — with free shipping on orders over $75.
          </p>
          <button
            className="btn"
            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Shop the catalog ↓
          </button>
        </section>
        <div className="promo-strip">
          <span>🎉 Launch offers — apply at checkout:</span>
          <span className="promo-code-chip">SAVE10</span>
          <span className="promo-code-chip">FLAT5</span>
          <span className="promo-code-chip">FREESHIP</span>
          <span className="promo-strip-note">Express delivery available · free shipping over $75</span>
        </div>
        </>
      )}

      <section id="catalog">
        <div className="toolbar">
          <div className="pills">
            <button
              className={`pill ${category === '' ? 'active' : ''}`}
              onClick={() => setParam('category', '')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`pill ${category === c.name ? 'active' : ''}`}
                onClick={() => setParam('category', c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {search && <p className="result-count">Results for “{search}”</p>}

        {error && (
          <div className="empty-state">
            <div className="emoji">⚠️</div>
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        )}

        {!error && !products && (
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-card" />
            ))}
          </div>
        )}

        {products && products.length === 0 && (
          <div className="empty-state">
            <div className="emoji">🔍</div>
            <h2>No products found</h2>
            <p>Try a different search or category.</p>
          </div>
        )}

        {products && products.length > 0 && (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
