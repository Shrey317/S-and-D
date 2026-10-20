# Payment setup and operations

Phase 7 update: [administrator order tools](administration-setup.md) now link receipt/refund reconciliation to fulfilment. Completion requires full verified payment for positive totals, no exceptions/refunds and active stock allocations; it consumes stock atomically without changing payment state. Completed refunds do not automatically restock produce. Dashboard and customer net spending exclude test/unpaid/cancelled/fully refunded records and subtract completed partial refunds from qualifying real paid/completed orders.

Phase 6 remains a local test implementation. No actual payment, refund, bank transfer or public deployment was performed. All checkout orders remain `isTest=true`; live Payfast mode is rejected. The owner chose to configure hosted services later.

## Local setup

Apply `pnpm db:migrate` to the local development database, then run `pnpm payments:local`. The helper writes generated credentials only to ignored local files and enables the payment ledger. It creates `sd_payments`, which inherits the narrow `sd_payment_processor` capability. Never use the owner, account or commerce login as `PAYMENT_DATABASE_URL`. Runtime guards reject excessive privileges and non-UTC sessions.

Run `pnpm test:db` to prepare the disposable `sd_catalog_test` schema, then `pnpm test:accounts`, `pnpm test:checkout`, and `pnpm test:payments`. Run `pnpm check` and restart the preview after a successful build. Test fixture cleanup explicitly refuses any database other than `sd_catalog_test`.

`PAYMENTS_ENABLED=true` plus `PAYMENT_DATABASE_URL` enables offline test records. Collection defaults to payment on collection. COD is available only with delivery, which still requires the existing exact-address approval and enabled delivery settings. Both remain unpaid until an authorized administrator records verified receipt. They retain allocation until cancellation or future fulfilment; they have no automatic payment deadline. Manual EFT has a 24-hour hold; Payfast and legacy test-only reservations have a 20-minute hold. These are development defaults requiring owner approval before launch.

`MANUAL_EFT_ENABLED` requires the payment ledger and all four approved bank fields in `.env.example`. Do not invent bank details. Transfer instructions are withheld once the payment is no longer eligible. Local orders explicitly prohibit real transfers; uploaded proof or a browser return never counts as received funds.

## Hosted Payfast sandbox procedure — pending

1. Obtain an owner-controlled Payfast sandbox account and its merchant ID, merchant key and passphrase. Put them in deployment secret settings, never chat or source control. The passphrase stays server-only; Payfast's hosted form requires its public merchant identifiers.
2. Use an approved public HTTPS development origin. Configure `PAYMENTS_ENABLED`, the restricted database URL, `PAYFAST_ENABLED=true`, `PAYFAST_MODE=sandbox`, and the three Payfast fields. Enable `PAYFAST_INSTANT_EFT_ENABLED` only if appropriate for the merchant integration. Method codes are `cc` and `ef`.
3. Notifications post to `/api/payments/payfast/notify`. The current adapter supports only verified Netlify hosting: `PAYFAST_TRUSTED_PROXY=netlify` and platform-owned `NETLIFY=true`. Prove on the actual deployment that Netlify overwrites `x-nf-client-connection-ip`, including a forged incoming header. Never set `NETLIFY=true` locally to bypass the source boundary. Other hosts require a reviewed trusted-source adapter. Loopback/unknown proxies return 503.
4. Complete a sandbox test-wallet payment and confirm the notification reaches the endpoint. The implementation verifies signed fields, merchant/reference shape, official source ranges, provider server confirmation and expected order amount. It records the transaction durably before acknowledging 200. Tampering receives 400; transient processing failures receive 503. The sandbox may deliver only one notification attempt; use reconciliation if delivery fails.
5. Prove duplicate delivery records one receipt, a forged browser return leaves payment unchanged, failure releases held stock, and a late verified payment records money without reviving an expired order. Observe application and gateway records together. A direct local mock is not evidence of hosted provider delivery.
6. Check hosted proxy/session/no-store behavior, callback secrets, scheduler expiry, merchant amount/reference matching and notifications after deployment restarts. Sandbox wallets do not verify actual card or bank EFT journeys.

Outbound hosts are fixed to `sandbox.payfast.co.za/eng/process` and `/eng/query/validate`. Notification validation uses a ten-second network timeout, no redirects, and a 16 KiB body limit. No raw notification/customer payload is retained in the event history. Source ranges are recorded in `src/server/payments/payfast.ts`; verify official changes before activation.

## Reconciliation and refund workflow

Provision an operator using the existing administrator guide; every page and action requires a verified local Auth identity, an operator grant, and a real MFA session. Open `/admin/payments`, then the payment detail. Read the order state, verified received total, completed refund total and exceptions before fulfilment. Customer status pages require the order owner and never interpret return/cancel query parameters as payment evidence.

For missing notifications, first verify the transaction in Payfast's dashboard. Record its exact numeric provider transaction ID, amount and evidence reason. The ID shares the notification receipt namespace, so a later notification cannot credit it again. For cash or bank receipts, verify actual receipt/cleared funds and use a unique reference. The form accepts only the exact expected amount. Provider amount mismatches and additional payments are retained as REVIEW with an exception; they must not be treated as normal fulfilment authorization.

Late receipts keep the order expired/cancelled and record a payment exception. Mismatched receipts are retained for review and are excluded from automatic expiry so the exception cannot silently discard money. Refund or investigate them before cancelling allocation. Repeating a receipt key/reference cannot credit it twice; cross-order references are rejected and flagged. Conflicting/partial receipts require investigation rather than editing immutable history.

Requesting a refund reserves refundable budget but sends no money. Complete the refund externally through the verified merchant dashboard or bank procedure, then record its unique external reference and evidence. A completion checkbox is required. Partial and full completed totals update separately; concurrent requests cannot exceed verified funds. Cancel an uncompleted request to release its refund budget. These controls never call a refund API. Administrator operations append actor/time/reason audit entries; the runtime cannot delete or rewrite audit history.

Cancelling allocation is separate from refund recording. It is allowed only for unfulfilled, unpaid or fully refunded orders. It releases held reservations once. Refunds do not automatically restock fulfilled produce. Full fulfilment/inventory administration is Phase 7.

## Expiry, migration and recovery

Run `pnpm reservations:expire` with the restricted commerce credential as an operational job. Request-triggered expiry is a backup, not a scheduler. A hosted scheduler is still a launch requirement. Expiry, notifications and admin actions serialize on order then payment rows before inventory changes; stock updates follow variant-ID order.

Migration `202610170002_payments` is additive: existing order snapshots/IDs remain valid and legacy test orders retain expiry behavior. Payment/refund/receipt foreign keys restrict deletion. Reapplying migrations is safe. The SQL function replacement recognizes new payment methods and excludes received funds from ordinary unpaid expiry.

Rollback by disabling `PAYFAST_ENABLED`, `MANUAL_EFT_ENABLED` and `PAYMENTS_ENABLED`, stopping new checkout if necessary, and preserving all payment/audit tables. Do not down-migrate or delete ledger history. Keep the current expiry function when rolling back application code: an older function does not understand offline holds or review receipts. Reconcile in-flight notifications and provider records before re-enabling. Restore procedures and backup recovery remain Phase 9 gates.

## Separate production activation gate

Live mode is intentionally rejected by configuration. Activation needs explicit owner approval, approved real catalog/bank details/payment deadlines, merchant onboarding, authenticated admin/MFA recovery, hosted callback spoof/replay tests, secure secrets, scheduled expiry, legal/policy approval, backups, monitoring and controlled genuine payment/refund verification. Production flags alone are not authorization. A later reviewed change must remove the local-only checkout and live-mode gates together with launch evidence.

Protocol references consulted for implementation: [Payfast developer documentation](https://developers.payfast.co.za/documentation), [ITN guidance](https://developers.payfast.co.za/docs/itn-instant-transaction-notification/), [sandbox limitations](https://support.payfast.help/portal/en/kb/articles/how-do-i-make-test-payments-in-sandbox-mode-20-9-2022), and [Netlify trusted header guidance](https://answers.netlify.com/t/upcoming-change-stripping-exposed-netlify-headers-from-function-and-proxy-requests/52665). Local protocol tests stub provider confirmation explicitly; hosted verification is still pending.
