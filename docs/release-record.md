# Release record — not approved for launch

Prepared 21 October 2026. Phase 10 preparation is approved. Blank/pending fields are unresolved requirements, not implied approvals. Record evidence and dates, never passwords, tokens or customer data.

| Item                                                     | Status / evidence needed                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Hosting account, site and exact origin                   | Pending owner selection                                                |
| Approval to deploy this reviewed preview                 | Pending                                                                |
| Reviewed Git commit / release snapshot                   | Pending; working-tree changes require review                           |
| Hosting build ID, adapter and runtime                    | Pending hosted build                                                   |
| Migration revision                                       | Local latest: `202610200001_popularity`; hosted application unverified |
| Public business identity, email and map location         | Pending verification                                                   |
| Genuine catalog, stock, pack units and image rights      | Pending owner approval                                                 |
| Five final policies and accepted policy versions         | Pending owner/professional signoff                                     |
| Delivery boundary, capacity and same-day rules           | Pending live configuration approval                                    |
| Hosted DB/Auth/pooler/RLS and OAuth/recovery             | Pending isolated staging verification                                  |
| Sender/domain, delivery webhooks and email scheduler     | Pending                                                                |
| Cloudinary upload/delivery/deletion                      | Pending                                                                |
| Payfast sandbox, trusted proxy source and reconciliation | Pending hosted verification                                            |
| Live checkout implementation and policy acceptance       | Not implemented in this release; local test orders only                |
| Merchant account and live payment activation             | Pending; live mode rejected by code                                    |
| Bank details and offline-payment operating procedure     | Pending owner verification                                             |
| Administrator provisioning, MFA, recovery and training   | Pending owner acceptance                                               |
| Off-site backup, key custody, RPO/RTO and restore        | Pending; local commerce drill only                                     |
| Monitoring, quota limits, alert recipient and response   | Pending assignment and exercise                                        |
| Real-device/screen-reader and hosted performance review  | Pending                                                                |
| Remaining development dependency advisory                | See Phase 9 security review; recheck before release                    |
| Public-launch approval and live-payment approval         | Pending, separate dated decisions                                      |
| Rollback deployment and migration compatibility          | Pending hosted evidence                                                |

## Local evidence

Phase 9 verified 91 unit/component tests, 71 database checks, 62 browser cases across the full run and affected-suite rerun, build/lint/format, outage behavior and an encrypted 33-table restore drill. See [the report](phase-9-verification.md). Phase 10 adds a read-only preview configuration check; its results are recorded in [Phase 10 preparation](phase-10-preparation.md). Earlier results are historical, not hosted launch evidence.

## Information needed to continue hosted work

Supply the hosting account/site choice and intended domain; verified legal business identity and business/privacy email; approved catalog and policy content; delivery rules; provider account availability; and recovery/monitoring ownership. Put service credentials in approved secret settings or a designated ignored local configuration file when needed, never in chat. Account access does not itself approve live payments or sending messages to customers.
