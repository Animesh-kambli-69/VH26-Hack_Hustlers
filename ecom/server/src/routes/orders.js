import { Router } from 'express';
import { createOrder, listOrders, getOrder } from '../controllers/orderController.js';

const router = Router();

router.post('/', createOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);

export default router;
