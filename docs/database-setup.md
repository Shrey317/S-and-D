# Catalog database — Phase 3

The implementation uses Prisma 7.10.0 with the PostgreSQL driver adapter, a private `commerce` schema, reviewed SQL migrations and a restricted catalog reader. Local verification uses real PostgreSQL 18.6. Hosted Supabase account and pooler verification were deferred by the owner on 16 October 2026; do not mark them verified from local results.

## Windows local setup

Install PostgreSQL and set `PG_BIN` to its binary directory if it differs from `C:/Program Files/PostgreSQL/18/bin`. The bootstrap uses installed binaries, creates a project-specific cluster under ignored `.local/postgres`, binds only to `127.0.0.1:55432`, and creates `sd_catalog_dev` and `sd_catalog_test`. It does not use or modify the machine's existing PostgreSQL service or databases.

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:local
pnpm db:migrate
pnpm db:local
pnpm db:seed
pnpm dev
```

The second bootstrap call places the development marker after the schema exists. Random owner/reader credentials are stored only in ignored `.local/database-secrets.json` and `.env.local`. An existing `.env.local` is preserved. Keep these files private. No built-in administrator or customer password is seeded.

Start an existing local cluster with `pnpm db:local`. Stop it when no preview/tests need it:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D .local/postgres -m fast stop
```

Do not delete the data directory as a reset procedure. Changes to the real catalog require reviewed migrations/imports. No reset script is supplied for development or production data.

## Roles and data visibility

`DIRECT_URL` belongs only to migration/operator tooling. Prisma config never falls back to `DATABASE_URL`. The local owner can migrate/seed; application reads use `sd_runtime`, a login member of `sd_catalog_reader`. The reader has SELECT only on the five catalog tables, no schema CREATE or data changes, no development-marker access and no RLS bypass. The application checks these capabilities before reading and returns a controlled unavailable state for unsafe credentials.

RLS hides inactive categories, draft/archived products, inactive variants and their related images/inventory. The application also applies visibility filters. Supabase API roles receive no commerce schema/table grants. Do not expose `commerce` through the Supabase Data API. Auth/customer tables and their ownership policies arrive in Phase 4; cart/order transactions arrive in Phase 5.

The schema constrains decimal prices, unique SKU/product/variant identities, nonnegative stock and reserved quantities no greater than on-hand. Product/category relationships use RESTRICT deletion. Monetary reads serialize decimal strings. Stock is allocated separately to each fixed pack size.

## Supabase setup, when authorized

Use a separate development Supabase project first. Run reviewed migrations with a privileged direct or session-pooler connection. The migration account must be allowed to create the private schema and reader role. Create a dedicated runtime login with a newly generated secret and grant only `sd_catalog_reader`; never use the `postgres` owner or a BYPASSRLS role in the storefront.

Use the project dashboard's exact connection parameters. Runtime uses a small pg pool (maximum 3) and a transaction-pooler connection when appropriate; migrations require direct/session mode. Require verified TLS for remote connections (for example `sslmode=verify-full` and the provider's trusted CA where needed). Do not use `rejectUnauthorized: false`. Custom-role pooler usernames must follow Supabase's project-specific format. Validate access, connection reuse and limits against that actual pooler before release.

Keep `DIRECT_URL` out of deployed application secrets; supply it only to the controlled migration job. `prisma generate` and a disconnected build work without migration credentials; migration commands fail against the non-routable unconfigured default. Do not use `db push`, automatic seed-on-start or reset against hosted data.

References: [Prisma PostgreSQL adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [Prisma config](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference), [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma), [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Verification

`pnpm test:db` requires `TEST_DATABASE_URL` (owner) and `TEST_READER_URL` (reader), both loopback and pointing specifically to `sd_catalog_test`. It **drops the commerce schema and the public Prisma migration-history table only in that isolated test database**, applies migrations fresh and again, then tests constraints, RLS, reader permissions, seed guards/idempotence, decimal variant reads, search/filter/sort/pagination and image-upload authorization/cleanup. It never resets `sd_catalog_dev`.

The GitHub workflow provisions an ephemeral PostgreSQL service and random reader credential before running database and browser tests. That workflow is authored, not remotely verified. Playwright uses the test reader, with `DIRECT_URL` removed from its server environment. Do not run database reset checks concurrently with browser tests.
