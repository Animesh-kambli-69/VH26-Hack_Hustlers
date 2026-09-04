const CUSTOMER_KEY = 'shopverse.customerId';

// Anonymous, browser-local customer identity (demo only — no auth in phase 1).
export function getCustomerId() {
  let id = localStorage.getItem(CUSTOMER_KEY);
  if (!id) {
    id = `cust-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CUSTOMER_KEY, id);
  }
  return id;
}

export function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
