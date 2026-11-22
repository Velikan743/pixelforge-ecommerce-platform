# TechParts

### PC components for your next build

**Live website: [Open TechParts](https://velikan743.github.io/pixelforge-ecommerce-platform/)**

TechParts is a PC components storefront demo for browsing parts, comparing options, and planning a build.

The website opens with **Sign in** and **Create account** before the storefront.

## Explore the website

- Browse graphics cards, processors, motherboards, memory, storage, power supplies, cases, cooling, monitors, peripherals, and accessories.
- Search with catalogue suggestions, combine store and category-specific filters, switch between grid/list layouts, and page through results at your chosen page size.
- Inspect recorded product specifications and compare up to four products in the same category with differences highlighted.
- Save products to a wishlist and add items to the shopping bag.
- Manage your profile and saved delivery addresses, then view submitted orders and their status.
- Build a PC from catalogue parts, see its total and specification-based compatibility warnings, then save it to your account or share a link.

## Admin workspace

Admin accounts open the admin workspace after sign-in. The overview shows catalogue size, inventory levels and value, customers, orders, and manually recorded payments. Admins can manage products and stock, set per-product low-stock thresholds, record reasoned stock adjustments, review reserved units and the stock movement log, set brands/SKUs/specifications, create/edit/disable categories and brands, review orders and update fulfilment/payment states, and search, block, or reactivate customer accounts. The storefront supports category, brand, price and in-stock filters plus price, newest, popularity, rating and discount sorting. Admin API routes require an authenticated admin session.

The initial admin account is provisioned by the API from `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables. The local development defaults are `admin1@gmail.com` and `admin111`; the first sign-in requires setting a new password. Production hosting must set a strong `ADMIN_PASSWORD` secret and `MONGODB_URI`. Do not use the local starter password in a deployed environment.

## Demo information

This is a portfolio project, not a production-ready store. Catalogue prices, availability, ratings, delivery details, product specifications, and compatibility need confirmation before any real sale. The starter catalogue is seeded with zero stock so products are unavailable until an admin sets inventory. The bag and wishlist are saved in this browser; named PC builds are stored with the account when the API is available. Checkout creates a persisted order and reserves inventory, but does not collect payment, calculate tax or shipping, arrange delivery, or issue an invoice. Sales and revenue reporting is limited to manually recorded payment statuses. Customer registration, sign-in, saved builds, and admin access require the API and MongoDB to be hosted and configured. Compatibility checks explicitly mark missing specification data for review and do not guarantee a working build.

See [FEATURE_STATUS.md](./FEATURE_STATUS.md) for the feature-by-feature comparison with the complete project idea and the remaining implementation plan. Orders are stored by the API and reserve stock, but payment, tax, shipping, and fulfilment integrations are not connected; treat this as a development project, not a live store.

## Built with

React and Vite power the storefront. The repository also includes an Express API and MongoDB integration for accounts, sessions, catalogue data, and admin product management. GitHub Pages serves the static storefront; connect it to a hosted API and MongoDB to enable account creation, sign-in, and the admin workspace. Set the Pages repository variable `VITE_API_URL` to the API's public base URL, and configure the API's `FRONTEND_ORIGIN` to allow `https://velikan743.github.io`.

---

Made in India · TechParts
