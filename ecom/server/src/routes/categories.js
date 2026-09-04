import { Router } from 'express';
import { listCategories } from '../controllers/productController.js';

const router = Router();

router.get('/', listCategories);

export default router;
