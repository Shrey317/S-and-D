# Administration setup and operating guide

Phase 7 is local development only. All existing catalog prices, packs and orders are test data. Hosted Auth, Cloudinary and Payfast verification remain deferred by the owner.

## Enable the local tools

1. Start the isolated PostgreSQL cluster with `pnpm db:local`, apply `pnpm db:migrate`, and start local Auth with Docker Desktop and `pnpm auth:local`.
2. Run `pnpm checkout:local`, `pnpm payments:local` and `pnpm admin:local`. The last command creates a separate restricted database login and writes `ADMIN_DATABASE_URL` and `TEST_ADMIN_DATABASE_URL` into the ignored local environment. It does not grant anyone administrator access.
3. Follow [controlled administrator provisioning](administrator-provisioning.md). Sign in using the approved account and complete authenticator verification before opening `/admin`. No seeded password, user metadata or customer-controlled role field grants access. The automated browser tests create and remove their own disposable MFA administrator.
4. Rebuild and restart the application after environment changes. Keep owner/migration and Auth service-role credentials out of the application runtime.

The `sd_admin_writer` role can manage catalog/configuration and read customer/order data. It cannot grant administrators, write payment ledger totals, modify order snapshots, or alter/delete audit and stock history. Payment/refund operations retain their separate restricted processor. Each page and mutation verifies identity, operator grant and AAL2 on the server; mutations also validate origin and rate limits. Revoking the grant prevents subsequent operations.

## Catalog and images

Create a product under Products, choose its category, enter its name, URL slug and description, then add its variants. Every selling pack needs a unique SKU, fixed price, selling unit and low-stock threshold. Kilograms and boxes are supported alongside packs, bags, bunches and individual items; quantity counts these defined selling units, not arbitrary fractional weights. New variants start with zero physical stock. Use Inventory to record counted stock.

Leave unfinished products in Draft. Active products require an active category, active variant and available stock before purchase. Archive a product or deactivate a variant/category to remove it from sale. These are the supported removal operations: historical orders and stock records are retained. Product and category changes update the storefront navigation and catalog. Featured products can be changed in the product editor.

The image form accepts JPEG, PNG and WebP up to 5 MB, validates the file signature and uploaded dimensions, and requires descriptive alternative text and image-rights provenance. Upload/delete controls remain disabled until Cloudinary is configured. Upload a replacement first, adjust its display order, check it, then remove the old image. Database attachment and its audit entry commit together; a failed attachment attempts cleanup of only the newly uploaded asset. Deletion detaches and audits first; failed remote deletion is reported as cleanup pending. Existing image metadata can be edited locally. See [Cloudinary setup](cloudinary-setup.md); remote delivery and deletion are not yet verified.

## Inventory and orders

Inventory shows physical, reserved and available packs. Enter the physical count and a reason of at least ten characters. A correction cannot lower physical stock below reservations. Versions reject stale corrections; replaying the same adjustment reference does not apply it twice. Stock history retains the previous/new count, reason, time, actor and associated order where applicable.

Orders can be searched and opened to review their immutable line prices, discounts, contact details, payment state and planning date. Internal notes remain administrator-only. Follow the payment link to record independently verified receipts or manage refund requests and externally completed refunds. A refund request alone does not mean money was returned.

After verifying actual handover, use Mark collected or Mark delivered. Positive-total orders require full verified payment, no payment exception and no refunds. Completion atomically consumes the held packs, records inventory adjustments and changes fulfilment status. Concurrent or repeated completion consumes stock once. A zero-total discounted order needs no receipt, but still requires a valid allocation. Local test orders never authorize a real purchase or handover.

Cancellation releases held packs once. Payment-bearing orders use the existing reconciliation workflow; received money must be fully refunded before cancellation. Completed orders cannot be cancelled. Older test orders without a payment ledger have a separate audited cancellation action. Refunds do not automatically return perishable stock; count any approved return and record a separate stock correction.

## Customers, offers and settings

Customer pages show profiles, saved addresses, order history and net qualifying spending, without passwords or Auth secrets. Delivery approval binds a specific saved address hash, the current settings version and an expiry within one year. Independently verify the address against the approved Lenasia service area before granting it. Customer edits, expiry or rule changes require approval again. A matching suburb string is insufficient.

Promotions support percentages, fixed rand discounts, product-specific specials and two-variant bundles. A bundle discounts complete sets of the two selected selling packs. Enter dates in Johannesburg time, positive limits and optionally a code. Blank codes apply automatically; an entered code selects that offer. Only one offer applies to a basket: the largest eligible automatic discount, or the specified code. Discounts are capped at eligible line totals; percentage fractions round down to cents. Quotes and orders calculate them on the server.

Global and per-customer redemption limits are enforced under transaction locks. Cancellation or expiry frees redemption capacity; completion or refund does not. Editing an offer changes its version and invalidates older checkout quotes. Historical order totals retain their original offer and discount. Deactivate an offer to stop new redemptions while retaining its history.

Store Settings controls phone, address, hours, about text, announcement, collection/delivery availability, suspension, closed dates, cutoff, same-day eligibility and daily order capacity. Changes invalidate checkout quotes and all existing delivery approvals. Credentials and VAT are not editable here. The defaults remain non-VAT, free eligible delivery, no minimum and a 19:00 cutoff.

Same-day remains off until the owner approves an operational policy. When enabled, it requires positive capacity, an open date, current time at/after opening and before closing, the ordering cutoff and the same-day cutoff. Capacity is shared across collection and delivery, and counts non-cancelled/non-expired orders including tests in the isolated environment. Full or closed dates are skipped. A zero capacity setting means no configured daily limit, and cannot enable same-day. Dates are provisional planning dates; customers do not choose time slots or receive an automatic same-day guarantee.

## Overview, audit and concurrency

Overview net sales use order creation dates in Johannesburg time, include only real paid/completed orders, and subtract completed refunds. Unpaid, test, cancelled, exceptional and fully refunded records do not count. Pending/completed counts and recent orders explicitly include tests. Bestsellers use qualifying completed orders; partial refunds reduce money but do not invent a returned-unit count. Phase 8 adds charts, date-range reports, Excel exports, email, alerts and manual WhatsApp confirmations; follow the [communications and reporting guide](communications-and-reports.md). Detailed reports retain fully refunded orders in gross/refund figures with zero net. Their order-performance counts exclude tests and include all real order states within the selected dates.

Catalog, stock, order, promotion, address-approval and settings actions append audit entries. Payment activity has its own append-only audit. Infrastructure-level grant/revoke operations continue to require the separate restricted operator log described in the provisioning guide; runtime administration cannot change those grants.

For this small store, administration and checkout share a settings-row lock so catalog/configuration cannot change between final quote verification and order creation. Order/payment writers lock the order before inventory; balances are locked in stable variant order. This intentionally favors correctness over high-volume write throughput. The test suite exercises last-stock, last-capacity, last-promotion and repeated-completion races with the real restricted roles.

## Migration, rollback and remaining verification

`202610190001_administration` is additive. It adds configuration, audit, stock history, notes, promotions and restricted capabilities; existing orders and payment data remain intact. Fresh and repeated migrations are tested. Do not drop the new tables or erase audit/financial records to roll back the UI. Disable ordering, retain a verified backup, and roll application code forward or back only after checking discount and consumed-reservation compatibility. Older application code must not accept new orders against active offers or assume all reservations are still held. Production restore/recovery drills remain Phase 9 launch gates.

Run `pnpm test:db` to prepare the disposable test schema, then the account, checkout, payment and administration suites. `pnpm test:admin` refuses non-loopback targets or databases other than `sd_catalog_test`. Use `pnpm test`, `pnpm lint`, `pnpm build` and `pnpm test:e2e` for application verification. Hosted services, real-device MFA, public deployment, operator acceptance and genuine transactions remain unverified and require their later release gates.
