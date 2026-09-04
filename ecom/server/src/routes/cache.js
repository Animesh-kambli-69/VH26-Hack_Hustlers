import { Router } from 'express';
import {
  getStats,
  getConfig,
  updateConfig,
  resetCache,
  getEvictions,
  streamEvents,
  simulate,
} from '../controllers/cacheController.js';

const router = Router();

router.get('/stats', getStats);
router.get('/config', getConfig);
router.post('/config', updateConfig);
router.post('/reset', resetCache);
router.get('/evictions', getEvictions);
router.get('/stream', streamEvents);
router.post('/simulate', simulate);

export default router;
