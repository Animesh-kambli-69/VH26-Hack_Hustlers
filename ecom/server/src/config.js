import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server/.env (real environment variables always take precedence).
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3001);
// Bound to localhost by default: in development the Vite dev server proxies
// /api/* here, so the browser never talks to the API directly.
export const HOST = process.env.HOST || '127.0.0.1';

// Phase 2 (caching & scaling) — exposed now so the cache/DB layers can read
// them as soon as they're implemented.
export const REDIS_URL = process.env.REDIS_URL || '';
export const DATABASE_URL = process.env.DATABASE_URL || '';

export const SERVER_ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(SERVER_ROOT, 'data');
export const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
