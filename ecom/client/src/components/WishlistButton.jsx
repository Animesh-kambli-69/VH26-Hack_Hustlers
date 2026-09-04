import { useWishlist } from '../context/WishlistContext.jsx';

function HeartIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

// Wishlist toggle. `variant="text"` shows a labeled button (used on the
// product page); the default renders as a circular icon button.
export default function WishlistButton({ productId, variant = 'icon' }) {
  const { has, toggle } = useWishlist();
  const saved = has(productId);

  if (variant === 'text') {
    return (
      <button
        type="button"
        className={`btn btn-ghost wish-btn-text ${saved ? 'saved' : ''}`}
        aria-pressed={saved}
        onClick={() => toggle(productId)}
      >
        <HeartIcon filled={saved} />
        {saved ? 'Saved' : 'Save to wishlist'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`wish-btn ${saved ? 'saved' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      onClick={() => toggle(productId)}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}
