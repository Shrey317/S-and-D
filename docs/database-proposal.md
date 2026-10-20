# Database proposal

Phase 3 implements Category, Product, ProductVariant, ProductImage and InventoryBalance with a private schema, RLS, migrations and a development marker. This document remains the proposal for later customer, order, payment and administrative entities. See database-setup.md for the implemented local procedure; hosted Supabase setup was deferred by the owner.

## Conventions

- UUID primary keys; UTC `timestamptz` for events, local dates/time rules for business schedules.
- `numeric(14,2)` monetary values and decimal-safe operations; serialize decimal strings to clients. Basis points for percentages. Define rounding per line with deterministic order-discount allocation and rounding-remainder handling before promotion implementation.
- Explicit foreign keys and deletion actions, indexed foreign keys, unique natural keys, positive quantities and nonnegative amounts.
- Customer data is server-only in a non-exposed commerce schema. Database grants and RLS are versioned migrations. Runtime and migration roles are separate.
- Preserve immutable order item, address, contact, policy, promotion and settings snapshots. Catalog deactivation must not affect history.
- Fixed-size variants with integer stock units. A 500 g pack and a 1 kg pack have distinct IDs and explicitly allocated stock.

## Relations and key fields

| Entity                 | Key fields and relationships                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UserProfile            | ID; unique nullable auth-user UUID FK; name; phone; role; account state. Auth deletion unlinks identity after approved anonymization, without deleting retained orders.      |
| Address                | Owner FK; structured street/number/locality/postcode; recipient; optional coordinates; normalized fingerprint; active/default flags.                                         |
| DeliveryZone           | Approved boundary or street/number rule definition; version; effective dates; enabled flag.                                                                                  |
| AddressVerification    | Address and zone FKs; zone version; verified fingerprint; method; reviewer; timestamp. Editing an address invalidates the old verification.                                  |
| Category               | Unique name/slug; description; position; active flag.                                                                                                                        |
| Product                | Category FK; unique slug; name; description; draft/active/archived state; featured flag.                                                                                     |
| ProductVariant         | Product FK; unique SKU; unit enum; size/label; decimal price; active flag; low-stock threshold.                                                                              |
| ProductImage           | Product FK; unique Cloudinary asset reference; position; alt text; dimensions; rights/provenance.                                                                            |
| InventoryBalance       | Unique variant FK; on-hand; reserved; version.                                                                                                                               |
| InventoryAdjustment    | Variant FK; signed quantity delta; reason; actor; source reference; timestamp. Append-only.                                                                                  |
| InventoryReservation   | Order/item/variant FKs; quantity; expiry; held/consumed/released state; transition timestamps.                                                                               |
| Cart                   | Owner FK or hashed guest token; expiry; merge destination; version. Exactly one owner form.                                                                                  |
| CartItem               | Cart and variant FKs; positive quantity; unique cart/variant pair.                                                                                                           |
| WishlistItem           | Customer/product FKs; unique pair.                                                                                                                                           |
| Order                  | Unique order number; customer FK; idempotency key and fingerprint; method; lifecycle; fulfilment state; expected date; totals; immutable contact/address/settings snapshots. |
| OrderItem              | Order FK; product/variant references; snapshot SKU/name/unit/size/quantity/unit price/discount/line total.                                                                   |
| Payment                | Order FK; method; unique attempt reference; unique provider transaction ID when known; expected/received amount; currency; state; timestamps.                                |
| PaymentEvent           | Payment FK when resolved; deduplication key/fingerprint; provider state; verification and processing outcome; redacted metadata.                                             |
| Refund                 | Payment/order FKs; amount; reason; requested/processing/completed/failed state; provider reference; approving/confirming actor.                                              |
| Promotion              | Type/value; normalized optional code; dates; active flag; usage limits; stacking/priority rule.                                                                              |
| PromotionTarget        | Promotion FK and eligible product/variant/category target; unique target tuple.                                                                                              |
| PromotionBundleItem    | Promotion FK; component variant; required quantity; unique promotion/variant pair.                                                                                           |
| PromotionRedemption    | Promotion/customer/order FKs; allocated discount; held/committed/released state.                                                                                             |
| Notification           | Recipient FK; event/order reference; type; read timestamp.                                                                                                                   |
| OutboxJob              | Unique event key; type; payload; status; attempts; next attempt; claim lease; last redacted error.                                                                           |
| EmailDelivery          | Job FK; provider message ID; template; attempt/result; delivery/bounce timestamps.                                                                                           |
| CommunicationAction    | Order FK; channel; prepared/opened/administrator-marked-sent action; actor; timestamp.                                                                                       |
| ContactSubmission      | Name/contact; message; handling status; retention timestamp.                                                                                                                 |
| StoreSettings          | Singleton; business identity; contact; timezone; nominal cutoff; availability; non-VAT state; thresholds; version. No infrastructure credentials.                            |
| BusinessHours          | Settings FK; weekday; opening/closing times; closed flag.                                                                                                                    |
| FulfilmentRule         | Method; same-day eligibility deadline; lead time; capacity; effective dates.                                                                                                 |
| FulfilmentDateOverride | Local date; method; closure/availability/capacity override.                                                                                                                  |
| ContentPage            | Unique page/version; editable about/legal content; draft/approved/published state; approving actor.                                                                          |
| PolicyAcceptance       | Customer/order FKs; immutable accepted page versions; timestamp.                                                                                                             |
| AuditLog               | Actor; entity; action; redacted before/after; request ID; timestamp. Append-only.                                                                                            |
| PrivacyRequest         | Customer FK; access/deletion type; identity verification; status; resolution.                                                                                                |
| RateLimitBucket        | Hashed actor/scope; window; count; expiry; unique bucket key.                                                                                                                |

## State and constraint decisions

Payment: UNPAID, AWAITING_PAYMENT, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED; additional attempt-level abandoned/expired detail must not overwrite verified receipts. Order lifecycle separately represents active, cancelled and exception cases. Fulfilment displays Pending, Delivered or Collected, with clear exceptional notices.

`0 <= reserved <= on_hand`; price/discount/refund values cannot be negative. Discount totals cannot exceed eligible amounts. Cumulative refunds cannot exceed confirmed receipts. These cross-row rules require locked transactional checks rather than only column CHECK constraints.

Use a partial unique index to enforce at most one active production administrator. User profile updates cannot grant roles. Keep unique active customer cart, guest token, order/idempotency key and provider transaction constraints. Index order customer/date and status/date, catalog category/active/price, reservation state/expiry, and job state/next-attempt.

Do not cascade deletion from products, customers or payments into financial history. Archive products/categories with history. Receipts retain ordinary non-VAT totals. Privacy anonymization retains only approved necessary records. Tests must prove historical snapshots cannot be rewritten by a normal product/profile update.

## Transaction requirements

Order creation locks inventory in deterministic order, reloads prices/rules, reserves promotion usage and creates order/items/payment attempt/outbox atomically. Unique idempotency keys return existing results on retries. Expiry, payment and cancellation serialize on the same reservation/order records. Stock ledger entries are idempotent per transition/source reference. Refund and payment adjustments require audit entries in the same transaction.

Promotional bundles reserve component SKUs. Avoid independently double-counting bundle stock. Order-level discount allocation must make line snapshots sum exactly to the order total. Customer spending/reporting uses confirmed payments minus completed refunds, with completed revenue separately restricted to qualifying fulfilled, non-cancelled orders.

## Migration and seed policy

Phase 3 will pin the Prisma client/adapter, add `prisma.config.ts`, schema and SQL migrations, and test a fresh database plus repeat deployment. Migration credentials are available to controlled tooling only. Use reviewed forward migrations in production; never `db push`, destructive reset or automatic development seeding on production.

Development seed execution will require an explicitly non-production target. Seed approximately 30 sample products with sample prices, customers, orders, stock and promotions, visibly marked as development data. Credentials must be provisioned securely without committed passwords. Production catalog import requires owner-approved data and cannot import fake orders/customers.
