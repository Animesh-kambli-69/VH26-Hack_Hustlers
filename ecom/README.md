# ShopVerse — E-commerce Application

A full-stack e-commerce app built with **React (JSX)** on the frontend and **Express** on the
backend. The architecture is deliberately layered so that **caching and horizontal scaling can be
added in a later phase** — this phase intentionally contains **no cache and no scaling measures**.

## Features

- Product catalog (15 products, 5 categories) with category filters, search and sorting
- Product detail pages with ratings, stock status and related products
- Shopping cart with quantity management (persisted in `localStorage`)
- Checkout with shipping details + payment method (mock payments: card / UPI / COD)
- Order confirmation page and order history ("My orders")
- REST API with server-side validation, stock checks and server-side pricing
- Free-shipping logic (free over $75, else $6.99) computed on the server

## Tech stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Frontend | React 18 (JSX), React Router 6, Vite 5                     |
| Backend  | Node.js 20, Express 4                                       |
| Data     | JSON file store for orders, in-memory product catalog       |

## Project structure

```
ecom/
├── package.json                 # root scripts (install:all, dev via concurrently)
├── scripts/
│   └── generate-product-images.mjs  # generates the SVG product images
├── server/                      # Express REST API
│   └── src/
│       ├── index.js             # entrypoint
│       ├── app.js               # express app: middleware + route mounting
│       ├── config.js            # port/host/data-file config
│       ├── routes/              # URL → controller mapping (thin)
│       ├── controllers/         # request parsing / response shaping (thin)
│       ├── services/            # business rules (cache would wrap these)
│       ├── data/products.js     # product catalog
│       └── db/fileDb.js         # demo JSON-file order store (DB in phase 2)
└── client/                      # React (JSX) app
    ├── vite.config.js           # dev server + /api proxy → Express
    └── src/
        ├── main.jsx             # entry (BrowserRouter + CartProvider)
        ├── App.jsx              # route table
        ├── api/client.js        # fetch-based API client
        ├── context/CartContext.jsx
        ├── components/          # Navbar, Footer, ProductCard, Stars, QuantityPicker
        ├── pages/               # Home, Product, Cart, Checkout, OrderSuccess, Orders, NotFound
        └── styles.css
```

## Getting started

Prerequisite: Node 18+ (tested on Node 20).

```bash
npm run install:all   # installs server + client dependencies
npm run dev           # starts the API (:3001) and the web app (:5173)
```

Then open **http://localhost:5173**.

Run each half separately if you prefer:

```bash
npm run dev --prefix server   # API only, http://127.0.0.1:3001
npm run dev --prefix client   # web only, http://localhost:5173
```

The Vite dev server proxies `/api/*` to the Express backend, so the frontend always uses
same-origin URLs (no CORS setup needed).

## Environment variables

Each app reads a `.env` file from its own directory (`server/.env`, `client/.env`). The
committed `.env.example` files are the templates; `.env` itself is git-ignored. Real
environment variables always take precedence over `.env` values.

| Variable                | Where   | Default                  | Purpose                                   |
| ----------------------- | ------- | ------------------------ | ----------------------------------------- |
| `NODE_ENV`              | server  | `development`            | Log format (`dev` vs `combined`)          |
| `HOST`                  | server  | `127.0.0.1`              | API bind address                          |
| `PORT`                  | server  | `3001`                   | API port                                  |
| `REDIS_URL`             | server  | — (not wired yet)        | Phase 2 cache connection                  |
| `DATABASE_URL`          | server  | — (not wired yet)        | Phase 2 database connection               |
| `VITE_API_URL`          | client  | empty → same-origin `/api` | API base URL used by the browser         |
| `VITE_API_PROXY_TARGET` | client  | `http://127.0.0.1:3001`  | Where the Vite dev proxy forwards `/api`  |

## API

| Method | Endpoint                              | Description                                  |
| ------ | ------------------------------------- | -------------------------------------------- |
| GET    | `/api/health`                         | Health check (LB-ready)                      |
| GET    | `/api/categories`                     | List categories                              |
| GET    | `/api/products?category=&search=&sort=` | List/filter products (sort: price-asc, price-desc, rating) |
| GET    | `/api/products/:id`                   | Single product                               |
| POST   | `/api/orders`                         | Place an order                               |
| GET    | `/api/orders?customerId=`             | Orders for a customer (newest first)         |
| GET    | `/api/orders/:id`                     | Single order                                 |

### POST /api/orders

Request body:

```json
{
  "customerId": "cust-abc123",
  "customer": {
    "name": "Priya Sharma",
    "email": "priya@example.com",
    "address": "42 Marine Drive",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "payment": "card"
  },
  "items": [{ "productId": 1, "qty": 2 }]
}
```

Response `201`: `{ "order": { "id": "ORD-…", "total": 266.97, "status": "confirmed", … } }`

Pricing (`subtotal`, `shipping`, `total`) is always computed on the server — the client's
claimed prices are never trusted.

## Architecture notes — preparing for phase 2 (caching & scaling)

- **Layered backend**: `routes → controllers → services → data/db`. Business rules live in the
  services, so a cache (e.g. Redis) can wrap the data access later without touching routes.
- **Stateless HTTP API**: every request carries what it needs (`customerId`, items, …), so the
  API can run as multiple instances behind a load balancer. A `/api/health` endpoint is already
  in place for that.
- **Single points to replace in phase 2**:
  - `server/src/db/fileDb.js` — the JSON file store is demo-only; swap in a real database
    (required before scaling, since a file store can't be shared across instances).
  - `server/src/services/productService.js` — in-memory stock decrements move to the shared DB.
- **Natural caching insertion points** (nothing implemented yet, on purpose):
  - Product catalog reads (long TTL, invalidated on stock changes)
  - Category listing (changes rarely)
  - Per-customer order history reads
- **Frontend**: `client/src/api/client.js` is the single data-access file — a query cache such as
  SWR/React Query would be introduced there in a later phase.
