# Authentication and account setup

Phase 4 uses Supabase Auth with `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.118.0. Passwords belong exclusively to Auth. Commerce stores UUID-linked profiles, addresses and product wishlists. No customer passwords or administrator accounts are seeded.

## Local development

1. Complete the catalog setup and apply all migrations with `pnpm db:migrate`.
2. Start Docker Desktop, then run `pnpm auth:local`. It only accepts the project's loopback development database, or the exact loopback test database in CI. It adds a separate restricted `sd_accounts` login, generates ignored local secrets, sets the loopback application origin (3000 locally, 3100 in CI), and starts the `sd-local-auth` Compose project.
3. Rebuild/restart the application. Use **http://127.0.0.1:3000**, matching `NEXT_PUBLIC_SITE_URL`; using `localhost` instead will intentionally fail origin checks.
4. Register at `/auth/register` using a development-only address such as `your-name@example.test`. Open **http://127.0.0.1:54324** for captured confirmation and recovery messages. Open links in the browser used to start the flow, so the PKCE verifier cookie is present. Local Mailpit never delivers to external inboxes.
5. Complete your profile, save/edit/remove addresses, and save products from their detail pages. Saved addresses do not establish delivery eligibility. Checkout and orders are Phase 5.

The containers run Supabase GoTrue v2.197.0, PostgreSQL, Mailpit and a minimal Auth-only gateway; exact image digests are pinned in `supabase/local/compose.yml`. Only the gateway (54321) and captured inbox (54324) bind to loopback. The Auth database is separate from the commerce development/test databases. This setup verifies the actual Auth provider but is not the full hosted Supabase platform or its Data API.

Stop without deleting data:

```powershell
docker compose --env-file .local/local-auth.env -f supabase/local/compose.yml stop
```

Run `pnpm auth:local` to start again. The named Auth volume persists identities; do not copy it or `.local` into production. Keep the local inbox, test traces and setup keys private. A future explicit local reset must target only this Compose project's volume; never run a blanket Docker prune.

## Hosted configuration — not yet verified

- Use a development Supabase project first. Set `AUTH_ENABLED=true`, its HTTPS URL and **publishable** key. Set a random server-only `AUTH_RATE_LIMIT_SECRET` of at least 32 characters.
- Apply Prisma migrations through a direct/session-pooler owner connection. Create a separate `LOGIN INHERIT NOBYPASSRLS` account login with a generated secret and grant **only** `sd_account_writer`. Its pooler connection goes in `ACCOUNT_DATABASE_URL`. Keep the catalog reader in `DATABASE_URL`. Runtime must not have owner, BYPASSRLS, schema CREATE or catalog-write privileges. Never grant account writer membership to `anon`, `authenticated` or `service_role`.
- Keep `commerce` excluded from the public Data API. The migration denies browser roles its tables. Runtime transactions set a local customer UUID derived from `getUser()`, with explicit owner predicates and RLS; the UUID is never accepted from a form or URL. Transaction-local state is cleared on pooled connection release. Validate this with the real hosted pooler before launch.
- Set the exact site origin and allowlist only the needed `/auth/callback` URLs, including `/auth/callback?next=/account` and `/auth/callback?next=/auth/reset-password`. Avoid production wildcard origins. Do not derive redirects from incoming Host/Forwarded headers.
- Enable email/password sign-in and **email confirmation**. Disable anonymous sign-in and unneeded providers. Set minimum password length to 12; configure available password-abuse protections and provider rate limits. Keep refresh token rotation enabled and verify project session policies.
- Use Supabase's standard PKCE confirmation/recovery templates, which link through Auth verification to the allowlisted callback. Custom templates must preserve PKCE. This application does not accept arbitrary `token_hash` sign-ins or implicit-flow token fragments.
- Configure a verified custom SMTP sender for production. Supabase trial email is not a production delivery solution. Test inbox delivery, spam handling, confirmation resend, expired/replayed links and password reset on the real domain. Local Mailpit evidence does not prove delivery.
- Cookies are server-managed, HttpOnly, SameSite=Lax, and Secure for HTTPS origins. There is no browser Supabase session client. The Next proxy refreshes cookies on account/auth/admin routes; every protected page/action still verifies identity. All personalized and cookie-refresh responses use private/no-store headers. Verify actual CDN behavior after an approved deployment.
- The application hashes rate-limit subjects with HMAC and atomically limits requests in PostgreSQL. Provider and edge protections must also be configured before launch; per-address limits alone do not stop distributed signup abuse. No forwarded IP header is trusted by this app.

## Google OAuth — implementation ready, provider setup deferred

1. In Google Cloud, configure a Web application OAuth client and consent screen for the verified store identity and domain. Add authorized test users while the consent screen is in testing.
2. Set Google's authorized redirect URI to the **Supabase project callback** `https://<project-ref>.supabase.co/auth/v1/callback`, not the application's callback.
3. Put the Google client ID/secret in Supabase's Google provider configuration. Never put the secret in a `NEXT_PUBLIC_` variable or application source.
4. Allowlist the application's exact `/auth/callback?next=/account` in Supabase, then enable `GOOGLE_AUTH_ENABLED=true`.
5. Test successful sign-in, cancellation, mismatched/replayed state, existing-email linking behavior and redirect origin on the real project. OAuth starts server-side through Supabase's PKCE flow; the return code is exchanged server-side. Production consent/domain verification remains an owner setup task.

Google credentials are not configured locally, so the Google button remains hidden. No real Google OAuth success is claimed.

## Passwords, MFA and account limitations

Changing a password from account security requires the current password. Email recovery creates a short-lived signed HttpOnly proof bound to the verified user and session, after a fresh PKCE exchange; an ordinary session cannot merely visit the reset page to bypass the current-password check. Saving clears the proof and requests global sign-out. Supabase access-token lifetime and revocation behavior must be verified for the production session policy; global refresh-session revocation is not a claim that every copied JWT instantly becomes unusable.

Customers may enroll a TOTP authenticator using its setup key. After enrollment, subsequent sign-ins must complete `/auth/mfa` before account data or mutations are allowed. Administrator access additionally requires an operator grant and a verified AAL2 token. No self-service factor removal/recovery shortcut is exposed; see the controlled administrator recovery guide.

Email changes, order history, reordering, customer deletion/export workflows and administrator commerce tools remain later-phase work. No account creation or saved address places an order. Legal policy content remains a draft pending owner review.

Sources: [Supabase SSR and proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [password and recovery flows](https://supabase.com/docs/guides/auth/passwords), [Google configuration](https://supabase.com/docs/guides/auth/social-login/auth-google), [SSR security/caching](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
