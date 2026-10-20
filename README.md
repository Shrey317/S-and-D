# S & D Fruit and Veg

Commercial fresh-produce storefront and administration application, being developed in owner-approved phases.

**Current scope: Phase 8 communications and reports.** MFA-protected administration now includes transactional email capture, retry and delivery history, in-app alerts, manual WhatsApp drafts, date-range sales charts and Excel workbooks. Orders are explicitly labelled test records. Hosted Resend, Payfast, Supabase, Google OAuth, SMTP and Cloudinary verification remain deferred. Nothing has been deployed; indexing remains disabled.

Local verification: 89 unit/component tests, 71 PostgreSQL checks across the phase, all 46 desktop/mobile browser cases, lint, formatting and the production build passed. See the [Phase 8 verification record](docs/phase-8-verification.md) for evidence and remaining service limits. Earlier phase reports retain their historical results.

## Local setup

Use Node.js **22.23.2** and pnpm **12.11.2**. The versions are recorded in `.node-version`, `package.json` and `netlify.toml`. Corepack can supply the pinned pnpm version if a pnpm shim is installed. Do not replace the lockfile with npm or yarn lockfiles.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Open http://localhost:3000. No service credentials are required. The example environment deliberately disables all integrations. Do not overwrite an existing `.env.local`; review it instead. The locally bundled fonts require no Google Fonts connection at build time.

For the database catalog, follow [database setup](docs/database-setup.md): `pnpm db:generate`, `pnpm db:local`, `pnpm db:migrate`, `pnpm db:local`, then `pnpm db:seed`. The bootstrap preserves an existing environment file. Build/typecheck commands generate the Prisma client automatically. Run `pnpm test:db` before `pnpm check` to prepare and verify the isolated test database used by Playwright. The test command resets only its explicitly named local test schema.

## Verification

For accounts, start Docker Desktop and run `pnpm auth:local` after applying the database migrations. Use [the Auth guide](docs/authentication-setup.md) for the local captured inbox and hosted setup. Run `pnpm test:db` then `pnpm test:accounts` before the browser suite; account browser tests use temporary genuine local Supabase identities. CI includes this Auth setup but has not run remotely.

For local carts and checkout, run `pnpm checkout:local` after migrations and Auth setup, then rebuild/restart. Run `pnpm test:checkout` after `pnpm test:db` and before browser checks. See [checkout setup](docs/checkout-setup.md). The local helper generates a distinct restricted commerce login and never enables genuine purchases.

For payment records, run `pnpm payments:local` after migrations, then `pnpm test:payments` against the prepared isolated test database. Rebuild/restart to enable local offline payment choices. This helper creates a separate restricted processor login; it does not enable Payfast or bank details. See [payment setup, reconciliation and activation gates](docs/payments-setup.md).

For administration, run `pnpm admin:local` after migrations, then `pnpm test:admin`. The helper creates a separate restricted administration login; it does not grant an administrator identity. Follow the [administrator operating guide](docs/administration-setup.md) and controlled provisioning procedure, then rebuild/restart.

For communications and reporting, run `pnpm communications:local` after migrations, then `pnpm test:communications` against the prepared disposable database. Rebuild/restart. This enables local email capture with a separate restricted worker login; it sends no external mail. Use `pnpm email:work` or the private administrator capture action to process queued records. See [communications and reporting operations](docs/communications-and-reports.md) for email states, manual WhatsApp actions, report definitions and deferred hosted setup.

```powershell
pnpm exec playwright install chromium
pnpm check
```

`pnpm check` runs formatting, lint, type checking, unit/component tests, a production build and Playwright against that built application, in that order. On Linux CI, install browser OS dependencies with `pnpm exec playwright install --with-deps chromium`.

| Command             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `pnpm dev`          | Local development server                                    |
| `pnpm build`        | Optimized production build; not a deployment                |
| `pnpm start`        | Serve the last production build on port 3000                |
| `pnpm format`       | Format owned source and documentation                       |
| `pnpm format:check` | Check formatting without edits                              |
| `pnpm lint`         | Next.js and TypeScript ESLint checks; zero warnings allowed |
| `pnpm typecheck`    | Generate Next.js route types, then strict TypeScript checks |
| `pnpm test`         | Unit and component tests                                    |
| `pnpm test:watch`   | Interactive unit/component testing                          |
| `pnpm test:e2e`     | Desktop/mobile Chromium tests; requires a successful build  |
| `pnpm check`        | All current phase checks                                    |

Playwright owns a temporary production server at `127.0.0.1:3100`. It refuses to reuse an existing server, preventing tests against stale code. Traces and screenshots are retained on failures and are gitignored.

## Configuration and boundaries

- `src/config/business.ts`: confirmed business defaults, including no VAT, free eligible delivery, no minimum and the 19:00 SAST cutoff. Database store/checkout settings supply the editable values in Phase 7.
- `src/config/env.public.ts`: explicit public allowlist; only publishable values may use `NEXT_PUBLIC_`.
- `src/config/env.schema.ts`: pure Zod validation for testability.
- `src/config/env.server.ts`: `server-only` credential boundary, validated during rendering and Node startup through instrumentation.
- `.env.example`: names and safe defaults; secrets belong in `.env.local` or deployment secret settings.
- Database, Auth, Cloudinary, payment and transactional email flags activate their implemented integrations when configured. Local email capture is separate from hosted sending; test notices never reach the provider.
- Live Payfast mode is rejected. APP_ENV=production requires a public HTTPS site URL, but passing configuration checks does not establish production readiness.
- No real customer data, development passwords or product prices are seeded in Phase 1.

## Documentation

- [Original owner-supplied implementation brief](docs/original-business-brief.txt)
- [Architecture and access boundaries](docs/architecture.md)
- [Database proposal](docs/database-proposal.md)
- [Design specification](docs/design-specification.md)
- [Ten-phase plan and route map](docs/phase-plan.md)
- [Production readiness and unresolved decisions](docs/production-readiness.md)
- [Dependency compatibility](docs/dependency-compatibility.md)
- [Architectural decision record](docs/adr/0001-application-architecture.md)
- [Testing and troubleshooting](docs/testing.md)
- [Phase 1 verification record](docs/phase-1-verification.md)
- [Phase 2 verification record](docs/phase-2-verification.md)
- [Database setup and roles](docs/database-setup.md)
- [Catalog data and guarded development seeds](docs/catalog-data.md)
- [Cloudinary setup and operator uploads](docs/cloudinary-setup.md)
- [Phase 3 verification record](docs/phase-3-verification.md)
- [Authentication, local email and Google OAuth setup](docs/authentication-setup.md)
- [Administrator provisioning and recovery](docs/administrator-provisioning.md)
- [Phase 4 verification record](docs/phase-4-verification.md)
- [Cart, checkout and reservation setup](docs/checkout-setup.md)
- [Phase 5 verification record](docs/phase-5-verification.md)
- [Payments, reconciliation and refunds](docs/payments-setup.md)
- [Phase 6 verification record](docs/phase-6-verification.md)
- [Administrator setup and operating guide](docs/administration-setup.md)
- [Phase 7 verification record](docs/phase-7-verification.md)
- [Communications and reporting operations](docs/communications-and-reports.md)
- [Phase 8 verification record](docs/phase-8-verification.md)
- [Storefront components and interaction states](docs/components.md)
- [Photography sources and licensing](docs/image-assets.md)

## Deployment status

`netlify.toml` prepares a Next.js build only. There is no registered hosting project, connected repository, public release or live payment activation. Netlify compatibility is documented, but an actual Netlify deployment has not been tested. Owner approval is required before deployment and before each later phase.

`.github/workflows/ci.yml` is ready for a future GitHub repository. It runs checks only and contains no deployment job or secrets. Remote CI is not verified until the project is connected and the workflow runs there.

Do not treat this foundation as production-ready. The [readiness checklist](docs/production-readiness.md) identifies the outstanding functional, operational and business gates.
