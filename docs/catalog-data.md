# Catalog data and development samples

`pnpm db:seed` accepts only development/test environments, loopback connections and the exact local database names `sd_catalog_dev` or `sd_catalog_test`. A database-side marker created by the explicit bootstrap is also required. It refuses remote/production targets. The seed is transactional and additive: rerunning does not delete records or overwrite edited stock/prices.

It creates Fruits, Vegetables and Extra plus 30 clearly labelled sample products with 60 distinct fixed-pack variants. Prices, stock and pack sizes are fictitious. Every sample product has `isSample=true`; the storefront displays a development banner and sample badges. `CATALOG_ALLOW_SAMPLES=true` is allowed only in development/test. Normal catalog queries exclude samples unless that flag is enabled. There are no fake customers, orders, reviews, promotions or sales rankings; those data models belong to later phases.

The homepage's featured list and shop results query PostgreSQL. Search is case-insensitive and treats SQL wildcard characters literally. Category, minimum/maximum price, availability, featured/popular choice, sort and page are encoded in the URL. Pagination uses 12 records with deterministic ID tie-breaks. The count and page share a repeatable-read transaction. Filters for price and stock match the same variant. The card displays the cheapest matching pack and its availability; other packs may differ.

The Popular option deliberately shows an explanatory empty state until real qualifying order data exists. It does not infer popularity from the seed or use a manually fabricated sales count. Order-based ranking is completed with the order lifecycle in Phase 5.

Product details load active variants and decimal prices from the server. Pack selection changes the displayed price, stock and bounded quantity. Add-to-basket and wishlist are visibly unavailable until their approved implementation phases. No order is placed by changing a pack/quantity.

## Owner-approved catalog import

No production sample import command exists. Prepare approved product/category names, slugs, descriptions, SKU, fixed pack label/unit, decimal ZAR price, allocated pack stock, featured status and licensed image/alt/provenance records. Production records use `isSample=false`, begin as drafts, and become active only after review. Do not import development records or clear the sample flag to make fictitious prices appear real. Phase 7 provides administrator catalog editing; a production import must be reviewed and verified against approved business data before launch.
