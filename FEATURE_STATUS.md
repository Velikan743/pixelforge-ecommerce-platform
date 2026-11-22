# TechParts feature coverage

This checklist compares the project with `TechParts_Complete_Project_Idea.docx`. “Partial” means a UI or basic version exists but does not yet meet the full workflow in the idea document. The document describes the desired product; it does not mean these features are already implemented.

## Current release

| Area | Status | Current coverage |
| --- | --- | --- |
| Home page and theme | Partial | Responsive storefront, category cards, featured catalogue, theme toggle saved in this browser. No real campaigns, brand collections, newsletter service, or System theme. |
| Customer accounts | Partial | Sign-up, sign-in, server sessions, role checks, sign-out, password change, and login throttling. No email/mobile verification, password reset, profile/address preferences, Google sign-in, or customer account blocking. |
| Catalogue and search | Partial | Categories, basic text search, price sorting, product cards and stock display. Search suggestions, pagination, list layout, popularity/rating sorting, brand/price/spec filters, and category management are missing. |
| Product information | Partial | Product details modal, description, price/discount, stock, rating summary and one image. Structured specifications, image galleries/zoom, warranty, delivery estimate, reviews, Q&A, share, and verified-purchase records are missing. |
| Cart and wishlist | Partial | Browser-persisted per-account cart and wishlist, quantity changes, remove, and add-to-cart actions. Coupons, taxes, actual shipping, price-drop alerts, and server-saved cart/wishlist are missing. |
| Product comparison | Partial | Up to three items and a basic side-by-side view. Same-category enforcement, technical specification rows, difference highlighting, replacement/removal, and live stock checks are missing. |
| PC Builder and compatibility | Incomplete | The current builder is a fixed sample configuration. Dynamic component selection, saved/shared builds, budget recommendations, and compatibility checks are not implemented; the current compatibility message is illustrative only. |
| Checkout and orders | Partial | Orders are now stored in MongoDB; the server recalculates prices, rejects stale prices or insufficient stock, reserves units, and exposes customer order history. Delivery form and order state are stored. Payment collection, tax/shipping calculation, serviceability, invoices, tracking, customer cancellation, returns, and refunds are missing. |
| Admin workspace | Partial | Admin-only product create/edit/delete, price/discount/description/stock changes, inventory KPIs, customer count, order list, fulfilment statuses, and manual payment-status records. Category/brand management, customer operations, coupons/campaigns, reviews/support, reports/exports, settings/staff roles, and audit history are missing. |
| Security and operations | Partial | Password hashes, server-side role checks, HTTP-only sessions, request validation, and basic login throttling. Email recovery, stronger distributed rate limiting, security/audit events, and operational policies need further work. |

## Not implemented yet

- Payment gateway integration and reliable payment reconciliation.
- GST-aware tax configuration, shipping rates, PIN-code serviceability, invoices, courier tracking, returns and refunds.
- Customer profile, saved addresses, notification preferences, reviews, product questions, and support tickets.
- Category/brand administration, complete category-specific filters, richer technical product specifications, and multiple product images.
- Dynamic PC Builder, documented compatibility rules, saved/shareable builds, and transparent budget-based recommendations.
- Coupons, promotional scheduling, price history/alerts, back-in-stock alerts, and personalized recommendations.
- Sales charts, exportable reports, customer-management tools, staff permissions, and admin audit history.

## Delivery plan

The idea document recommends delivering this in levels. The current work advances the essential release by adding persisted orders and server-side stock and price checks. The next essential milestones are customer profile/addresses, admin customer and catalogue taxonomy management, and a configurable category/filter experience. Payment, tax, returns, notifications, and delivery integrations should follow once suitable providers and store rules are selected. Advanced PC Builder, compatibility, price alerts, and recommendations follow after structured product specifications exist.

## Hosting requirement

GitHub Pages serves only the frontend. Customer sign-in, admin access, product management, and persisted order management require a deployed API and MongoDB configured through `VITE_API_URL`, `FRONTEND_ORIGIN`, and `MONGODB_URI`. Until those are configured, the newly implemented server-backed features cannot run on the live Pages site.
