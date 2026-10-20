# Phase 3 — catalog and database verification

Date: 16 October 2026 (Africa/Johannesburg). The owner approved Phase 3 and explicitly chose local implementation/testing with hosted Supabase and Cloudinary configuration deferred.

## Delivered

- Prisma 7.10.0/PostgreSQL schema, two reviewed migrations, constraints and private `commerce` schema. Catalog runtime uses a read-only role with RLS; an additional runtime capability check rejects owner/BYPASSRLS/write-capable credentials.
- Thirty clearly labelled development products and sixty distinct fixed-pack variants. Seeds require local target/environment and a database marker, are atomic/idempotent, and preserve existing edits. No fake customer/order/payment/sales data.
- Database-backed homepage features, shop search/category/price/stock/featured filters, name/price sorting, deterministic pagination and URL persistence. Mobile filters use the accessible drawer.
- Product details, pack-specific server prices and stock, bounded quantity, gallery and related products. Missing products return the not-found page. Cart/wishlist controls are visibly unavailable pending their phases.
- Protected operator image upload through the Cloudinary SDK: bounded/validated file input, scoped random public ID, no overwrite, alt/provenance/dimension metadata, database permission check before upload and cleanup of the new asset on persistence failure. No public signature/upload endpoint exists before administrator Auth.
- Local setup, guarded seed/import guidance, Supabase role/pooler setup notes, Cloudinary operator guide and PostgreSQL-backed CI configuration.

## Checks

| Check                                  | Result                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Formatting and ESLint                  | Passed; zero lint warnings                                                                                        |
| Strict TypeScript and production build | Passed; build `dOA5dpT21SM1GGzAE5da5`                                                                             |
| Unit/component suite                   | 43 passed                                                                                                         |
| Real PostgreSQL integration checks     | 16 passed                                                                                                         |
| Desktop/mobile browser suite           | All 32 unique cases passed across the full run and targeted reruns; details below                                 |
| Automated accessibility                | Catalog/product and homepage/contact checks passed in light/dark themes on desktop/mobile; filter drawer included |
| Production dependency audit            | Zero known advisories on 16 October 2026                                                                          |
| Secret/generated-file exclusions       | `.env.local`, `.local` credentials/data and generated Prisma client verified ignored by Git                       |

Database checks exercise fresh and repeated migrations, seed marker/idempotence, decimal/stock/SKU constraints, direct reader write/DDL denial, draft/category/variant/image visibility under RLS, literal search/injection inputs, same-variant price/stock filtering, pagination, featured/sample exclusion, updated variant prices, upload authorization, metadata persistence and new-asset cleanup. Cloudinary's network provider is explicitly stubbed in these checks.

Browser coverage includes live search, filter URLs/reload, sorting, pagination, variant pricing/quantity/stock, product 404s, empty/popular states, 320 px reflow, theme persistence, focus management, copy-address outcomes and manual unsent WhatsApp drafts. Desktop/mobile catalog and product screenshots were inspected.

## Corrections found during verification

The local test reset originally removed the commerce schema while leaving Prisma's migration-history table in public. It now resets both exclusively in the exact local `sd_catalog_test` database, and repeat execution passes. Development catalog data was not reset.

The shop's shared loading boundary initially streamed HTTP 200 before a missing product could return 404. The listing page and loading skeleton now live in the `(catalog)` route group, leaving detail lookup outside that loading boundary. The product 404 checks pass. This follows [Next's documented streaming-status behavior](https://nextjs.org/docs/app/api-reference/file-conventions/loading).

Windows worker startup timed out when heavier suites overlapped; unit workers are capped at two, and the final unit/build/browser sequence runs serially. The final full browser run passed 30 of 32 cases; two desktop checks timed out during a prolonged host execution pause. The basket focus check passed on rerun.

The theme rerun exposed an assertion timing error: its initial animation callback could sample streamed HTML before the browser's first paint. A throttled browser diagnostic reproduced an empty theme at 767.7 ms, the correct dark theme by 784.5 ms, and first paint at 796 ms. The test now records theme class changes and checks the class at the browser's actual first-paint timestamp, retaining evidence of an incorrect initial theme even if hydration later corrects it. Both persisted light and system-dark reloads are checked. The updated theme case passed three times on each viewport (six passes). All 32 unique browser cases have passed across these runs; this is not a claim of a single uninterrupted 32-case pass. No application code changed during these reruns. See [MDN's paint-timing API](https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming).

## Deferred and unverified

Hosted Supabase credentials, custom-role pooler behavior, connection quotas/TLS, genuine Cloudinary upload/delivery and hosted deployment remain unverified by explicit owner choice. The local cluster is real PostgreSQL, not a simulation of the hosted platform. GitHub/Linux CI is authored but has not run remotely.

Popular products intentionally remain an explanatory empty state until real qualifying order data exists in Phase 5. Sample records never establish sales popularity. Owner-approved production products/prices/images still need to replace development data. Full WCAG conformance, screen-reader/real-device testing and production performance/security review remain Phase 9 gates.

Phase 4 authentication/accounts and later cart/checkout/payment/admin work were not started. No public deployment, live charge, sent customer message or hosted-service mutation occurred. The local review server uses the development reader and is available at `http://127.0.0.1:3000/shop` while running.
