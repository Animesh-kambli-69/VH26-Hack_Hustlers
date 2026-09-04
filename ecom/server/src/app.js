import express from 'express';
import morgan from 'morgan';
import { NODE_ENV } from './config.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import ordersRouter from './routes/orders.js';

const app = express();

app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Simple health check (useful for load balancers in a later scaling phase).
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);

// 404 for unknown API routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

export default app;
