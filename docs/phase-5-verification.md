# Phase 5 verification — 17 October 2026

Owner authorization: “continue to phase 5”, followed by “continue”. Hosted services remain deferred by the existing owner choice. Phase 6 and deployment are not yet authorized.

Implemented: database-backed guest/account baskets, bounded idempotent merging, quantity/remove controls, server checkout quotes, collection, owner-address delivery approval gate, immutable test-order snapshots, atomic inventory holds, unpaid expiry maintenance, private confirmation/history, and current-price reorder. Checkout is explicitly development/test only. No payment, live delivery zone, legal-policy approval or genuine purchase is implied.

## Verified locally

- 58 unit/component tests passed, including decimal arithmetic, overflow, cutoff/closure handling and production rejection of test checkout.
- 16 PostgreSQL catalog/migration checks passed against a freshly reset disposable test schema.
- 9 account security checks passed again after the UTC connection correction.
- 11 new PostgreSQL checkout checks passed: restricted capabilities; persistent guests/concurrent one-time merge; RLS/owner isolation; stale-price rejection; concurrent idempotency; private orders; exact 20-minute deadline and paid-hold protection; current-price/stock reorder; last-pack race; exact-address approval invalidation; and suspension/collection-disable checks.
- All 46 desktop/mobile Chromium browser cases passed in one uninterrupted run (2.7 minutes): existing storefront/Auth regressions plus guest persistence, sign-in return to checkout, collection order, owner-only confirmation, order history and reorder. Axe accessibility and responsive checks passed; desktop/mobile checkout screenshots were visually reviewed.
- Final mobile layout places the summary/total before the form. All four desktop/mobile checkout cases were rerun successfully after that final change (31.8 seconds).
- Production build, strict TypeScript/route generation, zero-warning ESLint and repository formatting passed. Final build: `iYekXwwHE-sdGMnCSuKsz`. The local preview was restarted at `http://127.0.0.1:3000` using this build.

An initial expiry test caught a non-UTC Prisma pg-adapter timestamp mismatch. All application/tooling pools now request UTC sessions, and the suite asserts the deadline against PostgreSQL's clock. No development data was reset. Test fixtures are isolated and cleaned up. Tests never use genuine payment credentials or cards.

The initial browser run exposed an old wishlist selector that needed scoping after adding basket status messages, and announcement banners outside labelled landmarks. Both were corrected. A host suspension then caused `ERR_NETWORK_IO_SUSPENDED`; that interrupted run was stopped and replaced by the complete successful run above. No retries or waived failures were used for the final full run. CI and hosted deployment remain unverified.

Remaining production gates: real catalogue, owner-approved delivery boundaries/rules and policies, hosted Auth/Cloudinary verification, payment implementation, scheduler/monitoring, administration and launch approval. Planning dates remain provisional, no same-day or time-slot promise is made, and payment status is independent of order status.
