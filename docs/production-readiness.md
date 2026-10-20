# Production readiness ledger

**Not production-ready. Phases 1–9 are approved.** The catalog, accounts, test checkout, payment ledger, administration, communications and reports use local PostgreSQL and real local Supabase Auth with captured email. Hosted Resend, Payfast, Supabase, Google OAuth, SMTP and Cloudinary verification remain deferred. Genuine purchasing and live payments remain gated; local checks do not establish readiness for commercial transactions.

## Functional gates

- [x] Guests browse PostgreSQL products with category/search/price/availability/featured filters, sorting and pagination (local verification).
- [x] Popularity uses an aggregate-only restricted function for qualifying paid/fulfilled orders; samples, test orders and full refunds are excluded (local database verification).
- [x] Variant identities, fixed selling units and authoritative decimal prices are verified locally.
- [ ] Hosted Supabase connection/pooler/RLS and genuine Cloudinary upload/delivery verification.
- [x] Registration, verification, login, recovery, session refresh and MFA work against genuine local Auth with captured email.
- [x] Local Phase 4 evidence: 55 unit/component tests, 25 database checks and 42 desktop/mobile browser cases pass; see the phase report.
- [x] Local Phase 5 evidence: 58 unit/component tests, 36 database checks, 46 browser cases, final checkout recheck and production build pass; see the phase report.
- [x] Local Phase 6 evidence: 70 unit/component tests, 48 database checks, 46 expanded desktop/mobile browser cases and production build pass; see [the Phase 6 report](phase-6-verification.md). Hosted Payfast remains unverified.
- [x] Local Phase 7 evidence: 77 unit/component tests, 60 database checks, all 46 expanded desktop/mobile browser cases and the production build pass; see [the Phase 7 report](phase-7-verification.md). Hosted services and operational launch gates remain pending.
- [x] Local Phase 8 evidence: 89 unit/component tests, 71 database checks across the phase, all 46 expanded desktop/mobile browser cases and the production build pass; see [the Phase 8 report](phase-8-verification.md). Hosted email delivery and scheduling remain pending.
- [ ] Hosted Google OAuth, SMTP, session policy, pooler and CDN verification.
- [x] Customer profiles, saved addresses and wishlists persist with tested ownership boundaries locally.
- [x] Local test order history and current-price reorder work with owner-only access.
- [x] Guest/authenticated carts persist and merge idempotently (local PostgreSQL checks).
- [x] Local test checkout recalculates totals, captures its versioned acknowledgement and prevents duplicates.
- [x] Exact-address delivery approval gate, invalidation and free collection tested locally; delivery disabled by default.
- [ ] Owner-approved live delivery boundaries, capacity and final policy versions configured.
- [x] Local cutoff and same-day/next-day rules respect Johannesburg time, opening/closing hours, closures and atomic daily capacity; owner-approved live policy remains pending.
- [x] Concurrent local test orders cannot oversell; unpaid expiry releases once and excludes paid holds.
- [ ] Payfast sandbox and verified ITN work, including invalid/duplicate/delayed notifications.
- [x] Local COD, manual EFT and collection records remain unpaid until verified receipt; hosted operational checks remain pending.
- [x] Local refund requests/completions, overpayments and reconciliation preserve totals under concurrency.
- [x] Local customer/admin email outbox, capture, retry/delivery history and in-app notifications operate with restricted credentials. Hosted Resend sending and actual delivery remain unverified.
- [x] Manual WhatsApp draft preparation, opening and administrator attestation are separate audited operations. External recipient delivery remains unverified.
- [x] Local administrator tools manage products/categories/variants, stock history, order fulfilment/cancellation, customers, promotions, settings and image metadata; hosted image uploads/deletions remain unverified.
- [x] Local reports exclude test records, reconcile qualifying sales/refunds, use Johannesburg date ranges and separately count real order states. Synthetic qualifying fixtures are removed after verification.
- [x] Authorized Excel exports contain formatted totals and inert customer cell values; workbook round-trip checks use the same report snapshot.
- [x] Store administrator and stock actions append audit/history records; privileged grant/revoke uses the separate operator log pending production retention/recovery signoff.
- [x] Local customer ownership, per-operation MFA administrator authorization and restricted database capabilities are tested.
- [ ] All relevant unit/integration/E2E tests and production build pass.
- [ ] Mobile/browser/accessibility/performance review is complete with no critical issues.
- [ ] Metadata, canonical URLs, sitemap and verified Product/LocalBusiness structured data are ready.

## Owner and operational gates

| Dependency           | Default/mitigation                                | Required evidence                                                                                      |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Same-day policy      | No automatic same-day promises                    | Owner-approved eligibility deadline, capacity and payment conditions; 19:00 remains nominal cutoff     |
| Delivery area        | No reliance on free-text suburb or postcode alone | Approved boundary/street rules and verified-address workflow                                           |
| Map pin              | Do not publish guessed directions                 | Owner-verified physical map location                                                                   |
| Payfast              | Sandbox only; live rejected in foundation         | Merchant approval, credentials, verified notifications, reconciliation test and explicit live approval |
| Manual EFT           | No invented bank details or payment confirmation  | Approved bank details/reference/deadline and bank-verification procedure                               |
| Identity and contact | Use supplied trading identity only                | Verified legal identity, business email and applicable disclosures                                     |
| Real catalog         | No sample data treated as retail prices           | Approved products/units/prices/stock/images and rights                                                 |
| Policies             | Drafts require review                             | Approved privacy, terms, delivery, returns and cancellation policies and version records               |
| Hosting              | Netlify Free candidate, no deployment yet         | Owner deployment approval; hosted Next.js/SSR/actions/proxy/ITN/scheduler checks                       |
| Auth/email           | No external setup performed                       | Approved domain, OAuth URLs, sender verification, Auth mail and order email delivery                   |
| Administrator        | No seeded password                                | Controlled provisioning, MFA, recovery and operating handover                                          |
| Recovery             | No provider backup assumed                        | Encrypted off-site destination, retention, owner-approved RPO/RTO and tested restore                   |
| Monitoring           | To be configured before launch                    | Quota alerts, uptime checks, worker lag, payment exceptions and incident response owner                |

## Cost and availability risk

R0 fixed hosting is a target, not a guarantee of availability or zero total business expense. Netlify Free currently has a 300-credit monthly limit and can pause at exhaustion. Supabase Free can pause low-activity databases and needs off-site exports for an operator-controlled backup. Resend and Cloudinary also have quotas to verify against actual usage before launch. Domain registration, payment fees and optional paid upgrades are separate. The owner must approve upgrade thresholds and incident response before real orders are accepted.

Never infer a live credential, enabled flag or successful sandbox run as permission to activate payments. Explicit owner approval remains a human release gate.

## Privacy/legal review

Review obligations under [POPIA](https://www.justice.gov.za/legislation/acts/2013-004.pdf), [CPA](https://www.gov.za/documents/consumer-protection-act) and [ECTA](https://www.gov.za/sites/default/files/gcis_document/201409/a25-02.pdf). Confirm applicable retention, identity disclosures, perishable-goods returns, marketing consent, international processing and privacy requests. Generated policies are not legally verified. VAT functionality remains disabled until future professional review if registration changes.

## Release evidence

Before launch, record approved commit/build, migration revision, hosting adapter/runtime, service configurations (names only, no values), test reports, owner approvals, rollback plan, restore evidence and administrator acceptance. Remove noindex/robots restrictions only in that approved release. Never use development customers/orders/passwords in production.
