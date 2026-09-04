import { getProduct, decrementStock } from './productService.js';
import { fileDb } from '../db/fileDb.js';

// ---------------------------------------------------------------------------
// Order business rules: validation, pricing (server-side), stock reservation.
// ---------------------------------------------------------------------------

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

export function createOrder({ customerId, customer, items } = {}) {
  if (!customer || typeof customer !== 'object') {
    throw httpError(400, 'Customer details are required');
  }
  if (!customer.name || !String(customer.name).trim()) {
    throw httpError(400, 'Customer name is required');
  }
  if (!customer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email))) {
    throw httpError(400, 'A valid email is required');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw httpError(400, 'Your cart is empty');
  }

  const orderItems = items.map((item) => {
    const product = getProduct(item?.productId);
    if (!product) throw httpError(404, `Product ${item?.productId} not found`);

    const qty = Number(item?.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      throw httpError(400, `Invalid quantity for ${product.name}`);
    }
    if (product.stock < qty) {
      throw httpError(409, `Not enough stock for ${product.name} (only ${product.stock} left)`);
    }

    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      qty,
    };
  });

  // Reserve stock
  orderItems.forEach(({ productId, qty }) => decrementStock(productId, qty));

  // Pricing is computed on the server, never trusted from the client
  const subtotal = round2(orderItems.reduce((sum, it) => sum + it.price * it.qty, 0));
  const shipping = subtotal >= 75 ? 0 : 6.99;

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
    subtotal,
    shipping,
    total: round2(subtotal + shipping),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  return fileDb.push(order);
}

export function listOrders(customerId) {
  return fileDb
    .all()
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getOrder(id) {
  return fileDb.get(String(id));
}
