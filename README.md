# TechParts

A responsive computer parts storefront and PC builder built with React, Vite, Express, and MongoDB. The initial catalogue is demo data, so the storefront and API can be explored before connecting a database.

## Start the storefront

```sh
npm install
npm run dev
```

The Vite development server runs the customer interface and forwards `/api` requests to port 4000.

## Start the API

Copy `.env.example` to `.env`, set `MONGODB_URI` to a MongoDB connection string, then run:

```sh
npm run server
```

Without `MONGODB_URI`, the read-only catalogue API serves the included demo products from memory. Endpoints are `GET /api/health`, `GET /api/products?q=&category=&page=&limit=`, and `GET /api/products/:id`.

## Current scope

The demo includes category browsing, search, price sorting, a client-side shopping bag, light and dark themes, and a guided PC build view. Account flows, inventory editing, order placement, compatibility rules backed by verified hardware data, tax and shipping calculation, and payment processing need their respective services and business data before they can be enabled safely.
