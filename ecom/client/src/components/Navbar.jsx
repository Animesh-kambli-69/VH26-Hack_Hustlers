import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const onSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?search=${encodeURIComponent(q)}` : '/', { replace: true });
    setQuery('');
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">S</span>
          ShopVerse
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>
            Shop
          </NavLink>
          <NavLink to="/orders">My orders</NavLink>
        </nav>
        <form className="nav-search" onSubmit={onSubmit} role="search">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
          />
        </form>
        <Link to="/cart" className="cart-link" aria-label={`Cart with ${count} items`}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="20" r="1.6" />
            <circle cx="17" cy="20" r="1.6" />
            <path d="M2.5 3.5h2l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2l1.6-8.2H6" />
          </svg>
          {count > 0 && <span className="cart-badge">{count}</span>}
        </Link>
      </div>
    </header>
  );
}
