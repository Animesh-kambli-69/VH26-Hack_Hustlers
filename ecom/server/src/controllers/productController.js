import * as productService from '../services/productService.js';

// Thin controllers: parse request, call the service, shape the response.
// Keeping them thin means a cache/queue layer can wrap the services later
// without touching routing logic.

export function listProducts(req, res, next) {
  try {
    const { category, search, sort } = req.query;
    const products = productService.listProducts({ category, search, sort });
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export function getProduct(req, res, next) {
  try {
    const product = productService.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

export function listCategories(req, res, next) {
  try {
    res.json(productService.listCategories());
  } catch (err) {
    next(err);
  }
}
