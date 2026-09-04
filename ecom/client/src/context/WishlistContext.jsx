import { createContext, useContext, useEffect, useState } from 'react';

const WishlistContext = createContext(null);
const STORAGE_KEY = 'shopverse.wishlist';

function loadWishlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(loadWishlist);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);

  const toggle = (productId) => {
    const id = Number(productId);
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const remove = (productId) => {
    const id = Number(productId);
    setIds((prev) => prev.filter((x) => x !== id));
  };

  const has = (productId) => ids.includes(Number(productId));

  return (
    <WishlistContext.Provider value={{ ids, toggle, remove, has }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
