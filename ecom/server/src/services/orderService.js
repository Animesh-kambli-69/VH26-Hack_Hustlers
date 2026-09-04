import { getProduct, decrementStock, restock } from './productService.js';
import { fileDb } from '../db/fileDb.js';
import { findPromoCode } from '../data/promoCodes.js';
import { cacheManager } from './cache/manager.js';
import { metaFor } from './cache/costModel.js';

// ---------------------------------------------------------------------------
// Order business rules: validation, pricing (server-side), stock reservation,
// promo codes, shipping methods and the order status lifecycle.
// ---------------------------------------------------------------------------

export const FREE_SHIPPING_THRESHOLD = 75;
export const STANDARD_SHIPPING_FEE = 6.99;
export const EXPRESS_SHIPPING_FEE = 12.99;

// Shipping options. etaDays = calendar days used for the delivery estimate.
export const SHIPPING_METHODS = {
  standard: {
    id: 'standard',
    label: 'Standard',
    desc: 'Free over $75, else $6.99',
    fee: STANDARD_SHIPPING_FEE,
    freeOver: FREE_SHIPPING_THRESHOLD,
    etaDays: 7,
  },
  express: {
    id: 'express',
    label: 'Express',
    desc: '$12.99 flat',
    fee: EXPRESS_SHIPPING_FEE,
    freeOver: null,
    etaDays: 3,
  },
};

// Order statuses in lifecycle order (cancellation is a terminal side branch).
export const ORDER_STATUS_FLOW = ['confirmed', 'shipped', 'delivered'];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function makeOrderId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${stamp}${rand}`;
}

function addDaysLabel(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Resolves client-supplied cart items against the live catalog and validates
// quantities. Shared by the quote endpoint and real order creation.
function resolveItems(items) {
  if (!Array.isArray(items)) return [];
  const orderItems = [];
  for (const item of items) {
    const product = getProduct(item?.productId);
    if (!product) throw httpError(404, `Product ${item?.productId} not found`);
    const qty = Number(item?.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      throw httpError(400, `Invalid quantity for ${product.name}`);
    }
    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      qty,
    });
  }
  return orderItems;
}

// The single pricing routine. Every number a customer sees (quote or a placed
// order) is computed here from server-side prices — never trusted from the
// client. Returns a plain summary; callers decide how to use it.
export function computePricing(orderItems, { shippingMethod = 'standard', promoCode } = {}) {
  const subtotal = round2(orderItems.reduce((sum, it) => sum + it.price * it.qty, 0));
  const method = SHIPPING_METHODS[shippingMethod] || SHIPPING_METHODS.standard;

  let shipping = method.fee;
  if (method.freeOver != null && subtotal >= method.freeOver) shipping = 0;

  const requested = promoCode ? String(promoCode).trim().toUpperCase() : '';
  const promo = findPromoCode(requested);

  let discount = 0;
  let promoLabel = null;
  let promoError = null;

  if (requested) {
    if (!promo) {
      promoError = `"${requested}" is not a valid promo code`;
    } else if (subtotal < promo.minSubtotal) {
      promoError = `${promo.label} — subtotal must be at least $${promo.minSubtotal.toFixed(2)}`;
    } else if (promo.kind === 'percent') {
      discount = round2(Math.min((subtotal * promo.pct + Number.EPSILON), promo.maxDiscount));
      promoLabel = promo.label;
    } else if (promo.kind === 'flat') {
      discount = round2(Math.min(promo.amount, subtotal));
      promoLabel = promo.label;
    } else if (promo.kind === 'freeship') {
      shipping = 0;
      promoLabel = promo.label;
    }
  }

  const total = round2(subtotal - discount + shipping);
  const estimateDate = addDaysLabel(new Date(), method.etaDays);

  return {
    subtotal,
    discount,
    shipping,
    total,
    shippingMethod: method.id,
    shippingLabel: method.label,
    etaDays: method.etaDays,
    deliveryEstimate: estimateDate,
    promoCode: promo ? promo.code : null,
    promoLabel,
    promoError,
  };
}

// Adds defaults so orders created before the order-lifecycle features still
// render correctly (timeline, delivery estimate, discount rows).
function withDefaults(order) {
  if (!order) return order;
  const items = Array.isArray(order.items) ? order.items : [];
  const pricing = computePricing(items, {
    shippingMethod: order.shippingMethod,
    promoCode: order.promoCode,
  });
  const events = order.events;
  return {
    ...order,
    discount: order.discount ?? 0,
    promoCode: order.promoCode ?? null,
    promoLabel: order.promoLabel ?? null,
    shippingMethod: order.shippingMethod || 'standard',
    deliveryEstimate: order.deliveryEstimate || pricing.deliveryEstimate,
    etaDays: order.etaDays ?? pricing.etaDays,
    events: Array.isArray(events) && events.length > 0 ? events : [{ status: order.status || 'confirmed', at: order.createdAt }],
  };
}

function validateCustomer(customer) {
  if (!customer || typeof customer !== 'object') {
    throw httpError(400, 'Customer details are required');
  }
  if (!customer.name || !String(customer.name).trim()) {
    throw httpError(400, 'Customer name is required');
  }
  if (!customer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email))) {
    throw httpError(400, 'A valid email is required');
  }
}

export function quoteOrder({ items, shippingMethod, promoCode } = {}) {
  const orderItems = resolveItems(items);
  const pricing = computePricing(orderItems, { shippingMethod, promoCode });
  return { items: orderItems, ...pricing };
}

export function createOrder({ customerId, customer, items, shippingMethod, promoCode } = {}) {
  validateCustomer(customer);

  const orderItems = resolveItems(items);
  if (orderItems.length === 0) {
    throw httpError(400, 'Your cart is empty');
  }

  // Reserve stock only after every line has been validated.
  for (const it of orderItems) {
    const product = getProduct(it.productId);
    if (product.stock < it.qty) {
      throw httpError(409, `Not enough stock for ${product.name} (only ${product.stock} left)`);
    }
  }
  orderItems.forEach(({ productId, qty }) => decrementStock(productId, qty));

  const pricing = computePricing(orderItems, { shippingMethod, promoCode });
  if (pricing.promoError) {
    throw httpError(400, pricing.promoError);
  }

  const createdAt = new Date().toISOString();
  const estimateDate = addDaysLabel(createdAt, pricing.etaDays);

  const order = {
    id: makeOrderId(),
    customerId: customerId ? String(customerId) : null,
    customer: {
      name: String(customer.name).trim(),
      email: String(customer.email).trim(),
      address: customer.address ? String(customer.address) : '',
      city: customer.city ? String(customer.city) : '',
      state: customer.state ? String(customer.state) : '',
      pincode: customer.pincode ? String(customer.pincode) : '',
      payment: customer.payment ? String(customer.payment) : 'card',
    },
    items: orderItems,
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    shipping: pricing.shipping,
    total: pricing.total,
    promoCode: pricing.promoCode,
    promoLabel: pricing.promoLabel,
    shippingMethod: pricing.shippingMethod,
    etaDays: pricing.etaDays,
    deliveryEstimate: estimateDate,
    status: 'confirmed',
    events: [{ status: 'confirmed', at: createdAt }],
    createdAt,
  };

  const created = fileDb.push(order);
  // New order → this customer's history changed (stock was already
  // invalidated by productService.decrementStock).
  if (created.customerId) cacheManager.invalidateKey(`orders:customer:${created.customerId}`);
  return created;
}

function computeListOrders(customerId) {
  return fileDb
    .all()
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(withDefaults);
}

// Order history is read repeatedly on the orders page and costs a fileDb
// read + sort per request — worth a short-TTL cache, invalidated on any write.
export function listOrders(customerId) {
  const key = `orders:customer:${customerId}`;
  const hit = cacheManager.get(key);
  if (hit !== undefined) return hit;

  const value = computeListOrders(customerId);
  cacheManager.set(key, value, {
    ...metaFor('ORDER'),
    sizeMB: Math.min(1.5, 0.3 + value.length * 0.05),
  });
  return value;
}

export function getOrder(id) {
  const key = `orders:detail:${String(id)}`;
  const hit = cacheManager.get(key);
  if (hit !== undefined) return hit;

  const order = withDefaults(fileDb.get(String(id)));
  if (order) cacheManager.set(key, order, { ...metaFor('ORDER'), sizeMB: 0.15, costLatency: 25 });
  return order;
}

// Any write to an order must evict that customer's cached history + the
// order detail so the next read reflects the new state.
function invalidateOrderCaches(order) {
  if (!order) return;
  if (order.customerId) cacheManager.invalidateKey(`orders:customer:${order.customerId}`);
  if (order.id) cacheManager.invalidateKey(`orders:detail:${order.id}`);
}

// Terminal transition — restores the reserved stock and marks the order
// cancelled. Only possible while the order is still 'confirmed'.
export function cancelOrder(id) {
  const updated = fileDb.update(String(id), (order) => {
    if (order.status === 'cancelled') throw httpError(409, 'This order is already cancelled');
    if (order.status !== 'confirmed') {
      throw httpError(409, `A ${order.status} order can no longer be cancelled`);
    }
    if (!Array.isArray(order.events)) order.events = [];
    order.items.forEach(({ productId, qty }) => restock(productId, qty));
    order.status = 'cancelled';
    order.events.push({ status: 'cancelled', at: new Date().toISOString() });
    return order;
  });
  if (!updated) throw httpError(404, 'Order not found');
  invalidateOrderCaches(updated);
  return withDefaults(updated);
}

// Demo helper: moves an order through the lifecycle (confirmed → shipped →
// delivered) so tracking can be exercised without waiting for real couriers.
export function advanceOrderStatus(id) {
  const updated = fileDb.update(String(id), (order) => {
    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
    const next = ORDER_STATUS_FLOW[currentIndex + 1];
    if (!next) {
      throw httpError(409, `Order is already ${order.status}`);
    }
    if (!Array.isArray(order.events)) order.events = [];
    order.status = next;
    order.events.push({ status: next, at: new Date().toISOString() });
    return order;
  });
  if (!updated) throw httpError(404, 'Order not found');
  invalidateOrderCaches(updated);
  return withDefaults(updated);
}
