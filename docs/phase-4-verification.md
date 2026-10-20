# Phase 4 — authentication and customer accounts

Local implementation and verification: 16–17 October 2026, Africa/Johannesburg. The owner approved Phase 4 by replying “continue” to its explicit approval request. Their earlier decision to defer hosted services remains in force.

## Delivered

- Supabase email/password registration, email confirmation/resend, sign-in, PKCE callbacks, password recovery and global sign-out. Password changes require the current password or short-lived recovery authorization bound to the verified user/session. Supabase owns all passwords.
- Server-validated identity, HttpOnly/SameSite cookies, secure cookies on HTTPS, private/no-store responses, strict origin and redirect checks, durable database rate limits and generic account-discovery responses.
- Profile, bounded address book with editing/removal/default addresses, and an idempotent product wishlist. Application owner predicates and transaction-local RLS prevent cross-customer access. Account writes use a separate restricted connection from the catalog reader.
- Optional authenticator enrollment and verification. Enrolled users must complete MFA on subsequent sign-ins before account data is accessible. Administrator access additionally requires an operator grant and verified AAL2; user metadata cannot grant privileges. The provisioning CLI verifies confirmed identity and an enrolled authenticator and enforces the sole-administrator procedure.
- Google OAuth initiation/callback integration with a disabled-by-default provider flag and explicit setup guide. Actual Google credentials and successful provider sign-in are deferred, not simulated.
- Genuine local GoTrue v2.197.0 with PostgreSQL and Mailpit, pinned container digests, loopback ports, generated ignored credentials and captured email. This is an Auth-only local setup, not a claim of full hosted Supabase behavior.

## Verification

| Check                                            | Result                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Existing catalog/database integration            | 16 passed against isolated PostgreSQL after all three migrations                                 |
| Account/database security                        | 9 passed in the final regression                                                                 |
| Unit/component tests                             | 55 passed in the final regression                                                                |
| New account browser journeys                     | 10 passed, desktop and Pixel 7 emulation                                                         |
| Complete storefront/browser regression           | 42 passed in one uninterrupted desktop/mobile run (2.9 minutes)                                  |
| Formatting, lint, strict types, production build | Passed; build `uwAkKiyud0sLnHiwLgMMu`                                                            |
| Production dependency audit                      | Zero known advisories, 17 October 2026                                                           |
| Visual/accessibility checks                      | Desktop wishlist and 320 px sign-in screenshots inspected; axe passed account forms and wishlist |

The account browser journeys exercise real registration and captured confirmation emails, password recovery and old-password rejection, replayed callbacks, cookie/cache properties, expired-session refresh with genuine refresh-token rotation, persistent profiles, forged address IDs across two users, wishlist save/removal, forged sessions, unprivileged administrator denial, real TOTP verification and renewed MFA after logout/login. Tests use temporary `example.test` identities and remove their Auth and commerce records. No external email was sent.

Database security checks cover role capability rejection, owner-scoped profiles, missing transaction identity, cross-customer reads/writes/reassignment, concurrent default-address selection, address limits, wishlist idempotence/visibility, administrator grant denial and atomic rate limits. Secrets and driver connection details are not printed in test failures.

## Corrections found during verification

- PostgreSQL's advisory-lock function returns `void`; its raw Prisma query now explicitly casts the result to text. The account security suite then passed.
- Local GoTrue required the `auth` schema, the compatibility `postgres` role, and an explicit `auth` search path. These are now in the local bootstrap. During initial setup, completed migration records were reconciled from the original public ledger to the auth ledger after comparing them. No customer data or development catalog was reset. Fresh CI setup is authored but has not run remotely.
- Signing out an unconfirmed registration erased its PKCE verifier. Signup now signs out only if the provider unexpectedly returns a session, preserving the verifier for normal confirmation.
- Error assertions were scoped to their forms to avoid matching Next's separate route-announcement alert.

## Deferred and limits

Hosted Supabase role/pooler/TLS/connection limits, real Google consent/provider login, production SMTP/inbox delivery, actual host cookie/CDN behavior, genuine Cloudinary delivery and remote CI remain unverified. No real store administrator was provisioned. Operator provisioning/recovery needs an owner drill; formal audit storage arrives with administration. Customer deletion/export and email-change workflows remain unavailable.

No cart, checkout, order history/reordering, payment, administrator commerce panel or public deployment was introduced. Sample catalog data remains labelled and excluded from production. Full accessibility conformance, device/browser coverage, abuse protection and production security/performance review remain later-phase gates.

Local review: `http://127.0.0.1:3000/auth/sign-in`; captured development inbox: `http://127.0.0.1:54324`. Follow [authentication setup](authentication-setup.md) and [administrator provisioning](administrator-provisioning.md). Phase 5 requires separate owner approval.
