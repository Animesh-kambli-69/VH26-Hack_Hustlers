import * as orderService from '../services/orderService.js';

export function createOrder(req, res, next) {
  try {
    const order = orderService.createOrder(req.body || {});
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

export function listOrders(req, res, next) {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId query parameter is required' });
    }
    res.json(orderService.listOrders(String(customerId)));
  } catch (err) {
    next(err);
  }
}

export function getOrder(req, res, next) {
  try {
    const order = orderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
}
