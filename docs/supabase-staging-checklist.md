# Supabase staging setup

Owner requested hosted Supabase setup after the Netlify storefront preview was published. On 21 October 2026, the owner selected Shrey317's Org and the connector created the separate `sd-fruit-veg-staging` project.

- Organization: `bklaqcluhoqotkopfqph` (Free tier at inspection).
- Project: `chxpreqcdrmakbyoydnv`, region `eu-west-1`, PostgreSQL 17.11.0.003, reported `ACTIVE_HEALTHY`.
- Dashboard: <https://supabase.com/dashboard/project/chxpreqcdrmakbyoydnv>.
- Initial inspection: no commerce schema, no Supabase migrations, no `sd_` database roles. The unrelated forklift project was not changed.

## Project and access

- The connector and dashboard are connected. The owner explicitly approved the temporary migration operator and the Auth URL/password-rule saves in chat.
- All eight existing Prisma migrations were applied with `prisma migrate deploy`, through the dashboard-confirmed session pooler `aws-0-eu-west-1.pooler.supabase.com:5432`. Prisma's ledger records all eight as finished.
- The migration operator `sd_migrator` owns the store objects but is now `NOLOGIN NOCREATEROLE`, its password is NULL, and its database/public-schema CREATE grants have been revoked. PostgreSQL's automatically created creator/admin membership does not confer SET or INHERIT access to postgres. No explicit postgres membership grant was applied.
- A short, expiring login window was needed to complete runtime role memberships after migration. The first immediate connection failed during the pooler's credential update; the later retry succeeded. The login was disabled again and independently verified.

## Database

- Follow `database-setup.md` and `authentication-setup.md` for the private `commerce` schema and restricted roles.
- Keep the migration owner connection in operator tooling only, separate from Netlify.
- Created `sd_catalog_app` with only `sd_catalog_reader` membership and `sd_accounts_app` with only `sd_account_writer` membership. Both are non-superuser, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS. Both passed the application's actual Prisma permission checks through the transaction pooler on port 6543.
- Client-to-pooler TLS encryption, certificate chain and hostname verification passed using the dashboard's public root CA. The app bundles that public CA in `src/server/db/supabase-certificate.ts`; it is not a secret. A connection helper strips the URL's `sslmode` only after validation so node-postgres cannot override the explicit verified TLS configuration. Backend `pg_stat_ssl` describes the pooler's separate database connection, not the client TLS session.
- All 33 commerce tables have RLS enabled. Hosted rollback-only checks proved owner reads, cross-customer UPDATE and INSERT denial, and transaction-local identity cleanup across five pooled connection reuses. No test profiles remain.
- The Data API exposes `public` and `graphql_public`, excluding `commerce`; the dashboard shows zero exposed tables/functions. `anon`, `authenticated` and `service_role` have no commerce schema access.
- Security advisors reported no warnings/errors. Two informational no-policy notices are intentional deny-all protection on `commerce.DevelopmentMarker` and `public._prisma_migrations`; do not add browser policies to silence them. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- No products or sample catalog were imported. Genuine catalog data remains a separate owner input.

## Authentication

- Saved and verified the site origin `https://snd-fruit-and-veg.netlify.app` and these exact callbacks:
  - `https://snd-fruit-and-veg.netlify.app/auth/callback`
  - `https://snd-fruit-and-veg.netlify.app/auth/callback?next=/account`
  - `https://snd-fruit-and-veg.netlify.app/auth/callback?next=/auth/reset-password`
- Email provider and email confirmation are enabled, anonymous sign-in and manual linking disabled. Saved and visually verified minimum password length 12. Refresh-token replay detection is enabled with a 10-second reuse interval; access-token expiry is 3600 seconds. Google and other providers remain disabled. Free-tier timed-session controls and leaked-password protection are unavailable; no upgrade was purchased.
- Registration, email confirmation, recovery and browser sessions still require end-to-end testing after the updated application is deployed. These flows are not yet verified by the configuration checks.
- Select an owner-controlled test recipient before sending confirmation/recovery messages. Production email delivery requires a verified SMTP sender.

## Application connection and verification

- Local changes add an explicit `DEPLOYMENT_PROFILE=supabase-staging` check for this project, separate catalog/account logins, transaction-pooler connections and `sslmode=verify-full`. Without this selection, the existing credential-free check still rejects credentials. This code must be tested, reviewed and deployed before adding Netlify credentials.
- Required application settings: `APP_ENV=preview`, the selected `NEXT_PUBLIC_SITE_URL`, `DATABASE_ENABLED=true`, restricted `DATABASE_URL`, `AUTH_ENABLED=true`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, restricted `ACCOUNT_DATABASE_URL`, and a newly generated `AUTH_RATE_LIMIT_SECRET`.
- Keep sample data, carts, local checkout, payments and unrelated integrations disabled for this stage. Never deploy `DIRECT_URL` or a Supabase service-role/secret key.
- Test registration, confirmation, login, recovery, session cookies, customer isolation, connection reuse and cache behavior against the hosted target. Record evidence without customer data or secrets.
- Record the reviewed release and hosted results before describing accounts or catalog integration as ready.

Local validation on 21 October: 51 focused deployment/environment/TLS tests passed, focused ESLint passed, TypeScript passed, and formatting/whitespace checks passed. The production build passed using `next build --webpack`. Turbopack failed to start its CSS child process on this Windows machine both inside and outside the sandbox; the normal Netlify build command is unchanged and its Linux build still needs verification. Hosted database evidence is recorded above; Auth end-to-end verification remains pending. The application changes are not yet deployed.

## Netlify handoff

The exact restricted configuration was generated into ignored `.local/netlify-supabase-staging.env` and passed the staging configuration gate. It contains only the site/project settings, catalog/account runtime URLs, public publishable key and server-only rate-limit secret. It does not contain DIRECT_URL, a migration password, service-role key or payment credentials. Do not display, commit or import the development `.env.local` file.

During final Netlify inspection, the project was found renamed to `snd-fruit-and-veg`, with current origin `https://snd-fruit-and-veg.netlify.app` and the same GitHub repository. The prepared local environment now uses this current origin. The owner approved replacement of the earlier profound-frangollo address and removal of its three callbacks; the corrected URLs were saved. Do not deploy until the Auth URLs and NEXT_PUBLIC_SITE_URL agree.

The Netlify production context still runs the credential-free preview. Deploy the reviewed application changes and import only this restricted staging configuration into that site's build/runtime environment before triggering the integrated staging deployment. This enables catalog/accounts only and still rejects orders/payments. Do not describe the public site as connected until the deployment and browser checks succeed.

Remaining external input: an owner-controlled recipient approved for confirmation/recovery tests; production custom SMTP and sender/domain verification remain separate. No emails were sent during setup.
