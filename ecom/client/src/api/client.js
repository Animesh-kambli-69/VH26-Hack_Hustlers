// Minimal API client.
// - In development VITE_API_URL is empty → same-origin /api, which the
//   Vite dev server proxies to the Express backend (no CORS issues).
// - For a deployed frontend pointing at a remote API, set VITE_API_URL
//   in client/.env (e.g. https://api.example.com/api).
// A response cache (e.g. React Query) would be introduced here in phase 2.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export const api = {
  getProducts(params = {}) {
    const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null);
    const qs = new URLSearchParams(entries).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  getCategories: () => request('/categories'),
  // Server-side price quote (shipping method + promo code) with no side effects.
  quoteOrder: (payload) => request('/orders/quote', { method: 'POST', body: JSON.stringify(payload) }),
  createOrder: (payload) =>
    request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
  advanceOrder: (id) => request(`/orders/${id}/advance`, { method: 'POST' }),
  getOrders: (customerId) => request(`/orders?customerId=${encodeURIComponent(customerId)}`),
  getOrder: (id) => request(`/orders/${id}`),
};
