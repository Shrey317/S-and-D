# Deployment preparation and operator handover

Phase 10 preparation authorized on 21 October 2026 by “continue” in response to the Phase 10 request. Hosted services remain deferred. No site, domain, provider account, external message or payment has been created by this preparation. Public deployment still requires approval of the destination and reviewed release.

## First hosted preview

The first deploy is a credential-free storefront compatibility check. It has no database catalog, customer accounts, checkout, payment processing or outgoing email. It remains noindex with an empty sitemap. Noindex is not access control: use host access protection if the preview must be private, and verify availability on the chosen plan.

`netlify.toml` runs `pnpm deployment:check && pnpm build`. The check accepts only `APP_ENV=preview`, an assigned HTTPS hostname and disabled integrations. It rejects sample/test checkout flags, integration/operator/test credentials and unexpected public variables, reporting field names without values. On Netlify it also rejects local environment files in the checkout. A pass checks configuration only; it is not a deployment, authorization, connectivity check or commercial readiness decision.

Use `config/deployment-preview.env.example` as the variable-name/value template. Its `.invalid` hostname deliberately fails until replaced. Never copy `.env.local` into hosting. The CLI reads the current process environment, not local dotenv files. For a local check of a separately prepared ignored file:

```powershell
pnpm exec tsx --env-file=.local/deployment-preview.env scripts/check-preview-deployment.ts
```

Do not use this command to build locally with production secrets: Next.js can also load local dotenv files. Hosted builds must use a clean checkout and deployment-scoped settings.

1. Owner chooses the Netlify account/site and exact preview origin, reviews the plan's current commercial terms, quotas and access protection, and approves this specific deployment.
2. Review the source snapshot and secret exclusions. Record the intended Git commit and review outstanding working-tree changes before selecting a release. Confirm ignored environment, `.local`, dumps and test artifacts are absent from tracked files. No migration/seed/test command belongs in the hosting build.
3. Set the template variables in the intended hosting context. Make application configuration available to Builds and Functions as supported by the account. `NEXT_PUBLIC_SITE_URL` is build-time application configuration: use the exact browsing origin and rebuild if it changes. Do not share authenticated configuration across changing preview URLs.
4. Use the pinned Node/pnpm versions and lockfile. Record the resolved OpenNext adapter version from the build. Do not replace `.next` with a static export or add a legacy adapter merely to obtain a green build.
5. After approval, deploy the reviewed snapshot and record the deployment URL, build ID, commit, adapter/runtime versions and configuration names. Keep the previous working deployment available.
6. Verify home/shop/info routes, images/fonts, 404s, client navigation, themes, keyboard behavior, CSP nonce freshness and hydration. Verify noindex, no private caching, no customer data and disabled integrations. A successful upload/build alone is not acceptance.

Netlify documents its OpenNext adapter and App Router/image support in [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/). Variable scopes and context must be checked against [build environment variables](https://docs.netlify.com/build/configure-builds/environment-variables/). These documents support the configuration approach; this application's hosted compatibility remains unverified.

## Hosted integrations and commercial release

The preview gate intentionally blocks services. Before replacing it with an integration-stage gate, provision an isolated hosted staging database/Auth project with operator-controlled credentials. Follow the existing database, Auth, Cloudinary, payment and communications guides. Verify restricted roles, RLS, connection pooling, TLS and ownership against that actual target. Local role tests do not prove a hosted deployment.

Keep migration and administrator-provisioning credentials in operator tooling, outside the app build/runtime. Runtime uses distinct catalog, account, commerce, payment, administration and communications identities. Store secret values only in approved secret settings; the release record stores names and verification evidence.

This source still supports **local test checkout only** and rejects live Payfast. It also publishes preview copy and noindex. A commercial release requires explicit engineering changes to checkout/order markers and final policy acceptance, verified payment configuration/callbacks, truthful storefront copy, real catalog validation and production SEO. Do not remove guards, relabel synthetic orders or set `APP_ENV=development` on hosting to bypass them. Complete sandbox and owned test-order reconciliation before requesting separate live activation approval.

Verify secure Auth cookies and recovery/OAuth callbacks on the exact domain; never use wildcard production redirects. Verify sender/domain ownership, real mail capture/delivery/event handling with authorized test recipients, Cloudinary uploads/deletions and asset rights. Configure and verify reservation expiry and authenticated outbox scheduling; opportunistic request-time expiry is not an adequate operational schedule. Record schedules, owners, missed-run alerts and retry behavior.

## Rollback and release acceptance

For preview failure, restore the prior known-good deployment and check its exact origin/headers. For a future commerce incident, suspend ordering and workers first, preserve audit/payment evidence, then roll back compatible application code. Redeploying code does not undo database writes, provider transactions or changed environment variables. Follow [backup/recovery and reconciliation](backup-recovery-runbook.md); never restore over the live database as a routine code rollback.

Before genuine orders: complete [the release record](release-record.md), [legal decisions](legal-content-review.md), hosted restore/identity recovery, administrator MFA/recovery acceptance, real-device/screen-reader review and monitoring ownership. Approve uptime/quota, backup-age, worker-lag and payment-exception alerts with response contacts. Record owner approval separately for public launch and live payments. Keep indexing disabled until the approved commercial release is verified.
