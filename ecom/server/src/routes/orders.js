import { Router } from 'express';
import {
  createOrder,
  quoteOrder,
  listOrders,
  getOrder,
  cancelOrder,
  advanceOrder,
} from '../controllers/orderController.js';

const router = Router();

router.post('/', createOrder);
router.post('/quote', quoteOrder);
router.post('/:id/cancel', cancelOrder);
router.post('/:id/advance', advanceOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);

export default router;
