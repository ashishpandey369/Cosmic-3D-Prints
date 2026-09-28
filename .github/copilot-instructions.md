# Gifty Hamper — Project Instructions

## Project goal
Build a professional, modern, responsive e-commerce website for the client. The frontend is developed in this repository first and will later be connected to WordPress + WooCommerce and Razorpay on the client's production hosting.

## Architecture direction
- Keep the frontend independent from GitHub Pages so it can later be deployed to any normal web server.
- Use clean, modular HTML, CSS, and JavaScript unless a framework is explicitly approved later.
- Use sample/local product data during the frontend phase.
- Design the catalog/data layer so sample data can later be replaced by WooCommerce API data without redesigning the UI.
- Keep product listing, product details, categories, search, filters, cart, checkout UI, and customer-facing flows modular.
- Do not integrate WooCommerce or Razorpay until explicitly requested.
- Never place API secrets, payment secrets, passwords, tokens, or private credentials in frontend code or this repository.

## Future e-commerce backend
WooCommerce will eventually manage:
- Products and categories
- Product variations
- Inventory/SKU
- Customers
- Cart/checkout
- Orders
- Coupons
- Shipping and tax
- Customer account functions

Razorpay will eventually handle online payments. Payment verification must happen server-side using trusted Razorpay callbacks/webhooks before an order is treated as paid.

## Required customer-facing areas
- Home
- Shop/catalog
- Categories
- Product details
- Search and filters
- Shopping cart
- Checkout
- Customer account
- Wishlist
- About
- Contact
- Corporate gifting
- FAQ
- Order confirmation

## Development rules
1. Inspect the existing repository before changing anything.
2. Preserve working files and functionality unless a change is necessary.
3. Do not use WordPress themes, Elementor, or page builders for the custom frontend.
4. Do not hard-code the eventual WooCommerce architecture into individual pages.
5. Prefer reusable components/patterns and centralized data/configuration.
6. Make every page responsive for desktop, tablet, and mobile.
7. Prioritize semantic HTML, accessibility, SEO, performance, and maintainability.
8. Avoid unnecessary dependencies and paid services during development.
9. Use realistic sample content/products when needed, clearly separated from application logic.
10. Keep secrets out of the repository; use environment/server-side configuration when backend work begins.
11. Before major architectural changes, explain the impact and inspect related files.
12. Test links, navigation, responsive behavior, JavaScript interactions, and console errors after changes.
13. Do not claim an integration is complete unless it has actually been implemented and tested.

## Development stages
### Stage 1 — Free frontend development
Build and test the complete customer-facing experience in GitHub using sample data. It must be suitable for GitHub Pages/static hosting during development.

### Stage 2 — Production e-commerce backend
When the client has hosting, install/configure WordPress + WooCommerce and connect the custom frontend to the backend as appropriate.

### Stage 3 — Payments and notifications
Add Razorpay payment integration and secure payment verification. Add reliable client order notifications (email first; WhatsApp/business messaging only through an appropriate production API/provider) and customer order confirmations.

### Stage 4 — Production deployment
Deploy to the client's server, connect the client's domain, configure HTTPS/SSL, production environment variables, backups, and required server/security settings.

## Current instruction
For the initial repository work, establish a clean foundation and folder structure. Do not start a random visual redesign or add WooCommerce/Razorpay yet. Inspect existing files first, then implement only the foundation required for the next approved step.
