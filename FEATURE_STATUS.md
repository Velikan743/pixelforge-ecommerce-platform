# TechParts feature coverage

This checklist compares the project with `TechParts_Complete_Project_Idea.docx`. “Partial” means a UI or basic version exists but does not yet meet the full workflow in the idea document. The document describes the desired product; it does not mean these features are already implemented.

## Current release

| Area | Status | Current coverage |
| --- | --- | --- |
| Home page and theme | Partial | Responsive storefront, category cards, featured catalogue, theme toggle saved in this browser. No real campaigns, brand collections, newsletter service, or System theme. |
| Customer accounts | Partial | Sign-up with name, email and mobile; sign-in, server sessions, role checks, sign-out, password change, and login throttling. Customers can edit their name/mobile and save up to 10 delivery addresses, select a saved address at checkout, and view their own orders. No email/mobile verification, password reset, notification preferences, or Google sign-in. |
| Catalogue and search | Partial | Admin-managed categories and brands, search suggestions across product/model/brand/SKU/category/spec text, combined category/brand/price/availability and data-driven category-specific specification filters, grid/list layout, 12/24/48 page sizes, pagination, and featured/price/newest/popularity/rating/discount sorting. |
| Product information | Partial | Product details show description, price/discount, stock, brand, SKU, entered warranty and structured specifications, plus rating summary and one image. Most seeded items still lack confirmed technical/warranty data. Image galleries/zoom, delivery estimate, reviews, Q&A, share, and verified-purchase records are missing. |
| Cart and wishlist | Partial | Browser-persisted per-account cart and wishlist, quantity changes, remove, and add-to-cart actions. Coupons, taxes, actual shipping, price-drop alerts, and server-saved cart/wishlist are missing. |
| Product comparison | Partial | Compare up to four products in one category. Shows entered specs, warranty, brand, model, ratings, price and availability; highlights differences and lowest price; supports add/remove/replace and disables add-to-bag for known out-of-stock items. Comparison quality depends on complete, accurate catalogue data. |
| PC Builder and compatibility | Partial | Select products from the catalogue for eight component slots, calculate a live total, remove/replace parts, and add a complete in-stock build to the bag. CPU/motherboard socket, memory generation, GPU/case clearance and PSU checks report compatible, incompatible or needs review based on entered data. Customers can save/load/delete named builds and share a link. Unknown data remains a review warning; there is no compatibility database, compatibility guarantee, budget recommender or saved-build version history. |
| Checkout and orders | Partial | Orders are now stored in MongoDB; the server recalculates prices, rejects stale prices or insufficient stock, reserves units, and exposes customer order history. Customers can use saved delivery addresses. Payment collection, tax/shipping calculation, serviceability, invoices, tracking, customer cancellation, returns, and refunds are missing. |
| Admin workspace | Partial | Admin-only product create/edit/delete, price/discount/description/stock changes, brand/SKU/specification editing, category and brand create/edit/disable/delete, inventory KPIs, order list and sequential fulfilment statuses, and manual payment-status records. Admins can search customers, view their order counts, and block/reactivate accounts. Coupons/campaigns, reviews/support, reports/exports, settings/staff roles, and audit history are missing. |
| Security and operations | Partial | Password hashes, server-side role checks, HTTP-only sessions, request validation, and basic login throttling. Email recovery, stronger distributed rate limiting, security/audit events, and operational policies need further work. |

## Not implemented yet

- Payment gateway integration and reliable payment reconciliation.
- GST-aware tax configuration, shipping rates, PIN-code serviceability, invoices, courier tracking, returns and refunds.
- Notification preferences, reviews, product questions, and support tickets.
- Multiple product images.
- Curated and routinely maintained hardware compatibility data, budget-based recommendations, and saved-build version history.
- Coupons, promotional scheduling, price history/alerts, back-in-stock alerts, and personalized recommendations.
- Sales charts, exportable reports, advanced customer segmentation, staff permissions, and admin audit history.

## Delivery plan

The idea document recommends delivering this in levels. Implemented essentials now include persisted orders, server-side stock/price checks, customer profiles and saved addresses, admin customer controls, category/brand administration, storefront brand/price/availability filters, richer comparisons, and a catalogue-backed PC Builder with saved/shareable builds and cautious compatibility checks. Payment, tax, returns, notifications, and delivery integrations should follow once suitable providers and store rules are selected. Reliable compatibility and budget recommendations depend on curated hardware data.

## Hosting requirement

GitHub Pages serves only the frontend. Customer sign-in, admin access, product management, and persisted order management require a deployed API and MongoDB configured through `VITE_API_URL`, `FRONTEND_ORIGIN`, and `MONGODB_URI`. Until those are configured, the newly implemented server-backed features cannot run on the live Pages site.
