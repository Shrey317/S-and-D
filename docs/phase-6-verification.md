# Phase 6 verification — 19 October 2026

Owner authorization: “continue” after the Phase 5 completion/Phase 6 request, followed by the current continuation. The owner explicitly deferred hosted service configuration. Phase 7, public deployment and genuine payment activation remain unapproved.

Implemented: additive payment, receipt, event, refund and audit records; configured checkout methods; server-signed Payfast sandbox forms; strict notification signature/source/merchant/reference/remote-confirmation checks; expected-amount reconciliation; idempotent concurrent receipt handling; method-specific expiry; late/extra/mismatched payment exceptions; private customer status; MFA/operator-gated receipt and refund administration. No browser return authorizes payment. Refund requests and external completion records remain separate. No action calls a bank or refund API.

## Verified locally

- 70 unit/component tests passed, including PHP-compatible request encoding, notification fixtures with blank fields, tampering/merchant/reference/status rejection, source ranges, provider confirmation rejection, method compatibility and deadlines.
- 16 catalog/migration checks passed against fresh and repeated disposable test migrations; the development migration applied additively without resetting the development catalog or existing orders.
- 9 account security checks and 11 checkout integration checks passed after adding payment permissions and creation.
- 12 payment integration checks passed against the actual restricted PostgreSQL processor: role/ownership denial; concurrent replay; failure after payment; late success after cancellation; expiry races; mismatches/additional receipts; cross-order provider references; collection/manual EFT/COD behavior; verified administrator receipts; partial/full refunds, idempotency and concurrent budget limits; cancelled refunds and unique external references.
- All 46 desktop/mobile Chromium browser cases passed in one complete run (3.7 minutes), with no retries or waived failures. Extended checkout checks confirm owner-only/no-store payment status, unchanged unpaid status after a forged success URL, denied anonymous/customer administrator access and disabled webhook rejection. Extended MFA checks record a verified receipt, request a refund without changing completed totals, and record external completion. Axe and responsive checks pass on the payment/admin journeys. Desktop/mobile payment-status screenshots were visually reviewed.
- Production build and its strict TypeScript checks, zero-warning ESLint and repository formatting passed. Build ID: `OU6wGscS7lTktE2yD58oJ`. The local preview was restarted on `http://127.0.0.1:3000`; shop/cart return HTTP 200 and the cart retains private no-store headers.

Local provider-confirmation tests use explicit stubs. PostgreSQL transactions, RLS, roles, inventory holds and Auth/MFA are real local services. Fixtures use generated test identities and cleanup refuses databases other than `sd_catalog_test`. No real card, bank transfer, refund, external email or hosted Payfast callback was exercised.

The build caught two test-only typing errors (a widened literal and inferred mock/request result shapes); these were corrected before the successful final build. The payment database tests passed without weakening permissions or changing financial expectations.

## Pending external evidence

Hosted Payfast merchant configuration, wallet payment/ITN round trip, trusted proxy spoof testing, sandbox delivery/retry behavior, actual card/EFT methods, production live activation, bank details and operational payment deadlines remain unverified. Hosted Auth/Cloudinary, scheduler, monitoring and recovery remain launch gates. See [payment setup and operations](payments-setup.md) for exact steps and rollback guidance. Local success does not establish commercial readiness.
