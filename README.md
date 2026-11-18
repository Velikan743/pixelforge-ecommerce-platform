# TechParts

### PC components for your next build

**Live website: [Open TechParts](https://velikan743.github.io/pixelforge-ecommerce-platform/)**

TechParts is a PC components storefront demo for browsing parts, comparing options, and planning a build.

The website opens with **Sign in** and **Create account** before the storefront.

## Explore the website

- Browse graphics cards, processors, motherboards, memory, storage, power supplies, cases, cooling, monitors, peripherals, and accessories.
- Search and sort the catalogue, then open product details or compare products.
- Save products to a wishlist and add items to the shopping bag.
- Try the guided PC builder, switch between light and dark themes, and explore the checkout preview.

## Admin workspace

Admin accounts open the admin workspace after sign-in. The overview shows catalogue size, in-stock products, low stock, out-of-stock items, estimated inventory value, and customer account count. Product management lets an admin add, edit, search, and delete catalogue items, including descriptions, prices, discounts, images, and stock. Admin API routes require an authenticated admin session.

The initial admin account is provisioned by the API from `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables. The local development defaults are `admin1@gmail.com` and `admin111`; the first sign-in requires setting a new password. Production hosting must set a strong `ADMIN_PASSWORD` secret and `MONGODB_URI`. Do not use the local starter password in a deployed environment.

## Demo information

This is a portfolio project and storefront preview. Catalogue prices, availability, ratings, delivery details, and compatibility need confirmation before a real sale. The starter catalogue is seeded with zero stock so products are not presented as available until an admin sets inventory. The bag, wishlist, and order history are browser demos; checkout does not place an order, arrange delivery, or process payment. Sales and revenue reporting is therefore not available yet. Customer registration, sign-in, and admin access require the API and MongoDB to be hosted and configured.

## Built with

React and Vite power the storefront. The repository also includes an Express API and MongoDB integration for accounts, sessions, catalogue data, and admin product management. GitHub Pages serves the static storefront; connect it to a hosted API and MongoDB to enable account creation, sign-in, and the admin workspace. Set the Pages repository variable `VITE_API_URL` to the API's public base URL, and configure the API's `FRONTEND_ORIGIN` to allow `https://velikan743.github.io`.

---

Made in India · TechParts
