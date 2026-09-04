import { products as catalog } from '../data/products.js';
import { cacheManager } from './cache/manager.js';
import { metaFor } from './cache/costModel.js';

// ---------------------------------------------------------------------------
// Product data access (Phase 2: cached).
//
// Read functions check the adaptive cache first; on a miss they run the same
// Phase 1 logic and store the result with a cost-model record. Stock writes
// invalidate the affected product/detail keys so customers never see stale
// stock.
// ---------------------------------------------------------------------------

// In-memory stock overlay so demo orders can decrement stock.
// (Moves to the shared database in a later phase.)
const stock = new Map(catalog.map((p) => [p.id, p.stock]));

function productListKey({ category, search, sort } = {}) {
  const cat = String(category || '').trim().toLowerCase();
  const q = String(search || '').trim().toLowerCase();
  const s = String(sort || '').trim().toLowerCase();
  return `products:list:${cat || 'all'}:${q || 'any'}:${s || 'any'}`;
}

// The actual (Phase 1) computation — deliberately kept separate so the cache
// wrapper above it stays a thin pass-through.
function computeList({ category, search, sort } = {}) {
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

export function listProducts(params = {}) {
  const key = productListKey(params);
  const hit = cacheManager.get(key);
  if (hit !== undefined) return hit;

  const value = computeList(params);

  // Cost model: a text search is far more expensive to recompute than a plain
  // category filter (filter + scan + sort), so it gets a richer meta record.
  const meta = String(params.search || '').trim()
    ? {
        ...metaFor('SEARCH'),
        sizeMB: Math.min(1.5, 0.8 + String(params.search).length * 0.02),
        costLatency: Math.min(300, 150 + (params.sort ? 80 : 0)),
      }
    : params.sort
      ? { ...metaFor('CATALOG'), sizeMB: 0.3, costLatency: 25 }
      : metaFor('CATALOG');

  cacheManager.set(key, value, meta);
  return value;
}

function computeProduct(id) {
  const product = catalog.find((p) => p.id === Number(id));
  if (!product) return null;
  return { ...product, stock: stock.get(product.id) ?? product.stock };
}

export function getProduct(id) {
  const key = `product:detail:${id}`;
  const hit = cacheManager.get(key);
  if (hit !== undefined) return hit;

  const product = computeProduct(id);
  if (product) cacheManager.set(key, product, metaFor('DETAIL'));
  return product;
}

function computeCategories() {
  return [...new Set(catalog.map((p) => p.category))]
    .sort()
    .map((name) => ({ id: name, name }));
}

export function listCategories() {
  const key = 'categories:list';
  const hit = cacheManager.get(key);
  if (hit !== undefined) return hit;

  const value = computeCategories();
  cacheManager.set(key, value, metaFor('CATEGORY'));
  return value;
}

// Stock writes: invalidate so cached detail/list responses can never show
// stale stock after an order or cancellation.

function invalidateProduct(id) {
  cacheManager.invalidateKey(`product:detail:${id}`);
  cacheManager.invalidatePattern('products:list:');
}

export function decrementStock(id, qty) {
  const current = stock.get(id);
  if (current === undefined) throw new Error(`Unknown product ${id}`);
  if (current < qty) throw new Error(`Insufficient stock for product ${id}`);
  stock.set(id, current - qty);
  invalidateProduct(id);
}

export function restock(id, qty) {
  const current = stock.get(id);
  if (current === undefined) throw new Error(`Unknown product ${id}`);
  stock.set(id, current + qty);
  invalidateProduct(id);
}
