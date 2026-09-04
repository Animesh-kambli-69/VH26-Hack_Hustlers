import { Router } from 'express';
import { listProducts, getProduct } from '../controllers/productController.js';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = Router();

router.get('/', cacheMiddleware(3600), listProducts);
router.get('/:id', cacheMiddleware(3600), getProduct);

export default router;
