import { products as catalog } from '../data/products.js';

// ---------------------------------------------------------------------------
// Product data access.
//
// NOTE: This is the natural insertion point for a caching layer in phase 2.
// All read logic is isolated here, so wrapping listProducts/getProduct with
// a cache (e.g. Redis) later would not require changes to controllers or
// routes.
// ---------------------------------------------------------------------------

// In-memory stock overlay so demo orders can decrement stock.
// (Moves to the shared database in a later phase.)
const stock = new Map(catalog.map((p) => [p.id, p.stock]));

export function listProducts({ category, search, sort } = {}) {
  let items = catalog.map((p) => ({ ...p, stock: stock.get(p.id) ?? p.stock }));

  if (category) {
    items = items.filter((p) => p.category.toLowerCase() === String(category).toLowerCase());
  }

  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }

  if (sort === 'price-asc') items.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') items.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') items.sort((a, b) => b.rating - a.rating);

  return items;
}

export function getProduct(id) {
  const product = catalog.find((p) => p.id === Number(id));
  if (!product) return null;
  return { ...product, stock: stock.get(product.id) ?? product.stock };
}

export function listCategories() {
  return [...new Set(catalog.map((p) => p.category))]
    .sort()
    .map((name) => ({ id: name, name }));
}

export function decrementStock(id, qty) {
  const current = stock.get(id);
  if (current === undefined) throw new Error(`Unknown product ${id}`);
  if (current < qty) throw new Error(`Insufficient stock for product ${id}`);
  stock.set(id, current - qty);
}

export function restock(id, qty) {
  const current = stock.get(id);
  if (current === undefined) throw new Error(`Unknown product ${id}`);
  stock.set(id, current + qty);
}
