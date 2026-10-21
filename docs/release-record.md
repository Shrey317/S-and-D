# Release record — not approved for launch

Prepared 21 October 2026. Phase 10 preparation is approved. Blank/pending fields are unresolved requirements, not implied approvals. Record evidence and dates, never passwords, tokens or customer data.

| Item                                                     | Status / evidence needed                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting account, site and exact origin                   | Shrey team; renamed site `https://snd-fruit-and-veg.netlify.app` (verified in Netlify dashboard)                                            |
| Approval to deploy this reviewed preview                 | Owner approved production preview deploy and adapter-fix push in chat on 21 October 2026                                                    |
| Reviewed Git commit / release snapshot                   | `c1dddfba17d2424fadde860ba34a6e464d4d7283`, verified on origin/main                                                                         |
| Hosting build ID, adapter and runtime                    | `6ad8cecefafb23fed5161472`, published 21 October 2026; Next.js adapter 5.16.4; one server function and one edge function; homepage verified |
| Migration revision                                       | All 8 Prisma migrations applied to staging through `202610200001_popularity`                                                                |
| Public business identity, email and map location         | Pending verification                                                                                                                        |
| Genuine catalog, stock, pack units and image rights      | Pending owner approval                                                                                                                      |
| Five final policies and accepted policy versions         | Pending owner/professional signoff                                                                                                          |
| Delivery boundary, capacity and same-day rules           | Pending live configuration approval                                                                                                         |
| Hosted DB/Auth/pooler/RLS and OAuth/recovery             | Staging pooler/TLS, runtime permissions and customer RLS passed; Auth settings configured, end-to-end browser/email tests pending           |
| Sender/domain, delivery webhooks and email scheduler     | Pending                                                                                                                                     |
| Cloudinary upload/delivery/deletion                      | Pending                                                                                                                                     |
| Payfast sandbox, trusted proxy source and reconciliation | Pending hosted verification                                                                                                                 |
| Live checkout implementation and policy acceptance       | Not implemented in this release; local test orders only                                                                                     |
| Merchant account and live payment activation             | Pending; live mode rejected by code                                                                                                         |
| Bank details and offline-payment operating procedure     | Pending owner verification                                                                                                                  |
| Administrator provisioning, MFA, recovery and training   | Pending owner acceptance                                                                                                                    |
| Off-site backup, key custody, RPO/RTO and restore        | Pending; local commerce drill only                                                                                                          |
| Monitoring, quota limits, alert recipient and response   | Pending assignment and exercise                                                                                                             |
| Real-device/screen-reader and hosted performance review  | Pending                                                                                                                                     |
| Remaining development dependency advisory                | See Phase 9 security review; recheck before release                                                                                         |
| Public-launch approval and live-payment approval         | Pending, separate dated decisions                                                                                                           |
| Rollback deployment and migration compatibility          | Pending hosted evidence                                                                                                                     |

## Local evidence

Phase 9 verified 91 unit/component tests, 71 database checks, 62 browser cases across the full run and affected-suite rerun, build/lint/format, outage behavior and an encrypted 33-table restore drill. See [the report](phase-9-verification.md). Phase 10 adds a read-only preview configuration check; its results are recorded in [Phase 10 preparation](phase-10-preparation.md). Earlier results are historical, not hosted launch evidence.

## Information needed to continue hosted work

Hosting is configured for the credential-free preview above. The owner selected Shrey317's Org for Supabase; `sd-fruit-veg-staging` (`chxpreqcdrmakbyoydnv`, `eu-west-1`) was created and reported healthy. All eight migrations and hosted database security checks passed; Auth settings are configured. Updated application deployment and end-to-end email/session testing remain pending. Follow [the Supabase staging checklist](supabase-staging-checklist.md). This is not approval to activate real orders or payments.

Still needed: verified legal business identity and business/privacy email; approved catalog and policy content; delivery rules; provider account availability; and recovery/monitoring ownership. Put service credentials in approved secret settings or a designated ignored local configuration file when needed, never in chat. Account access does not itself approve live payments or sending messages to customers.
