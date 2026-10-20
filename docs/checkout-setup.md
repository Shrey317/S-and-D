# Phase 5 cart and checkout setup

Phase 7 update: [administration](administration-setup.md) adds versioned settings, same-day opening/closing checks, shared daily capacity, percentage/fixed/product/bundle discounts and atomic redemption limits. Checkout locks current configuration, rechecks offers and capacity, and stores the accepted discount in its immutable snapshot. Paid order completion consumes reservations once; legacy test cancellation releases them once. Existing policy versions and local-only purchasing gates remain in force.

Phase 6 update: the current checkout adds configured payment choices and a separate ledger. See [payment setup](payments-setup.md) for method-specific expiry, verified receipts and refunds. The Phase 5 behavior below records the original milestone; legacy TEST reservations retain it. Payment-bearing orders use order → payment → inventory lock order, with COD/collection and received-funds exceptions excluded from unpaid expiry.

The owner approved Phase 5 on 17 October 2026 and chose local development while hosted configuration is deferred. This implementation creates **local test orders only**. It does not accept money, send orders to the store, notify customers or promise fulfilment. `LOCAL_CHECKOUT_ENABLED` is rejected in preview/production and requires Auth plus carts. Phase 6 implements actual payment choices and payment lifecycle rules.

## Local operation

Use the existing isolated PostgreSQL database and local Supabase Auth. Preserve `.env.local` and `.local`; never copy credentials into documentation.

```powershell
pnpm db:migrate
pnpm checkout:local
pnpm build
pnpm start
```

`checkout:local` is restricted to loopback `sd_catalog_dev`/`sd_catalog_test` development/test databases. It creates `sd_commerce` with a generated password and grants `sd_commerce_writer`, writes ignored runtime/test connection URLs, and enables carts plus local checkout. It does not overwrite hosted configuration. For a fresh setup, first follow the database and Auth guides. CI runs the helper after its disposable database and Auth setup.

The catalog, account and commerce pools use distinct roles. The commerce role can mutate only carts/lines, insert orders/reservations, update inventory reserved/version columns, read its own saved addresses/approvals, and execute narrowly scoped unpaid-expiry maintenance. It cannot change prices, stock on hand, delivery configuration, existing order snapshots or payment status. Runtime guard checks and database RLS fail closed; application queries also carry explicit owner predicates. Tables remain in the private `commerce` schema.

Every database pool uses UTC sessions. User-facing dates and the cutoff use Johannesburg time. This avoids the Prisma pg adapter's non-UTC timestamp behavior observed during local expiry testing; the integration suite compares the hold deadline with PostgreSQL's actual clock. Related upstream report: [Prisma driver adapter timestamp issue](https://github.com/prisma/prisma/issues/26786).

## Customer journey

- Select a pack and quantity on a product, then add it to the basket. `/cart` supports quantity changes, removal, current prices and unavailable-item notices. Guest tokens contain 32 random bytes, live in HttpOnly/SameSite cookies and are stored only as SHA-256 hashes in PostgreSQL. Baskets expire after 30 days, with limits of 50 variants and 99 packs per variant.
- Sign in for checkout. The next basket read merges the guest basket into the account basket under locks, then consumes the guest source. Repeated reads/login cannot add the same guest contents twice. Any quantity/line limit adjustment is reported in basket notices; stock is rechecked before purchasing.
- Checkout captures name/phone, verified account email, collection or a saved delivery address, a current quote and versioned local-test acknowledgement. New addresses are saved through the address book with a return-to-checkout link. No payment form or time-slot selector is presented.
- An order and its reservations commit atomically. A changed quote, insufficient stock, disabled fulfilment or missing approval leaves the basket intact. Customer-scoped idempotency keys plus input fingerprints return the original order on replay and reject changed requests using the same key. Client-provided prices, totals or customer IDs are never accepted.
- Confirmation and order details require the verified owner, including MFA when enrolled. History is paginated. Reordering adds available packs at current prices, reports omissions, and preserves historical order totals. Order history has no cascading dependency on customer/catalog deletion.

Money uses integer cents/decimal text with checked bounds, and PostgreSQL decimal columns. Snapshots preserve line names/SKUs/pack sizes/prices/quantities, contact/address, subtotal, zero discount, free fulfilment, total, settings version, acknowledgement version/time and the test-order marker. Promotions and real payment methods remain later phases; no invented discount is applied.

## Delivery and calendar gate

The default `CheckoutSettings` row enables collection, disables delivery and supports a global suspension plus closed dates. Only an operator/migration role can change it. Increment its version when approved rules change. Admin editing is Phase 7.

Delivery requires **all** of: enabled delivery, an address belonging to the signed-in customer, a non-expired operator `DeliveryApproval`, matching settings/zone version and a hash of the exact current recipient/contact/address/instructions. The runtime cannot grant approval. Editing the address invalidates the match. Approval records must include the reviewer/context in `reason`. No postcode/suburb guessing or development delivery boundaries are seeded. Tests use isolated fixtures and remove them.

Until the owner supplies actual approved boundaries, production approval workflow and operational deadlines, delivery remains disabled. Planning is conservative: no same-day date; before 19:00 SAST start from the following date, after cutoff start a day later, skipping configured closed dates. The UI labels this **provisional**, requiring readiness confirmation; it is not a promised fulfilment date. Store opening hours remain separate. Capacity, same-day policy and live payment-dependent dates must be configured and verified before real ordering is activated.

## Reservation maintenance

Test orders are unpaid with a 20-minute hold. Basket/checkout/history requests opportunistically process expired holds; idle installations can run:

```powershell
pnpm reservations:expire
```

The command processes up to 200 expired unpaid orders per batch, locks orders then all affected inventory in stable ID order, and releases each hold once. Paid, refunded and other non-unpaid states are excluded. Expired orders remain in history. There is no permanent scheduled worker yet; hosted scheduling/monitoring is a later deployment gate. Future payment, cancellation and fulfilment handlers must share this order-then-inventory lock discipline and implement late-payment reconciliation before using it for real orders.

For schema rollback, disable `LOCAL_CHECKOUT_ENABLED`/`CART_ENABLED` and revert application code first. Preserve orders/snapshots/reservations; do not drop tables or reduce reservations manually. Only the explicitly disposable test database may be reset by `test:db`.
