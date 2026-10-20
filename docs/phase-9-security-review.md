# Phase 9 security review

Local source and automated review, 20 October 2026. This is not an independent penetration test or hosted deployment assessment.

## Changes and boundaries

- HTML responses now use an unpredictable per-request CSP nonce, overwritten at the proxy boundary and applied to Next.js and the theme bootstrap. Production builds disallow script `unsafe-inline` and `unsafe-eval`; the latter is allowed only by the development compiler. Object embedding and framing are denied. Styles retain `unsafe-inline` for the existing UI libraries. Pages render dynamically and remain private/no-store, trading CDN HTML caching for nonce isolation. See [Next.js CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).
- Auth refresh is restricted to private routes. Each protected page/action/handler still verifies identity independently; the proxy is not the authorization boundary. Existing operator-grant/AAL2, strict origin, ownership and database capability tests remain required.
- The WhatsApp POST now limits streamed bytes, including requests without Content-Length. Its destination comes from a validated saved draft, never a supplied redirect URL. Opening is not sending.
- Catalog popularity now uses a fixed-search-path SECURITY DEFINER aggregate function. PUBLIC execution is revoked. The reader receives product IDs/counts only, never orders, customer identity or payment details. Samples, test orders, unpaid/incomplete/exceptional orders and full refunds do not contribute.
- Shared store configuration reads fail to safe display defaults during a database outage. The catalog reports unavailable; it does not invent stock or prices. A root error boundary avoids leaking error details. This fallback does not enable ordering.

## Dependency findings

The initial registry audit reported five advisories. Targeted overrides update ExcelJS's UUID dependency to 11.1.1, Prisma config's deepmerge-ts to 8.0.0, and Prisma's mysql2 to 3.23.1. Compatibility must be verified through generation, migrations, the full build and workbook round trips. No broad framework upgrade was made.

One **high-severity development dependency advisory remains**: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), deeply nested patterns in `braces@3.0.3`, reached through Next's ESLint plugin → fast-glob → micromatch. The registry reports no published patched version. ESLint processes repository-controlled paths/configuration, not visitor input. Do not execute lint/configuration from untrusted contributions with secrets or elevated trust. Recheck before release and update the compatible toolchain when a fix exists. The full dependency audit is intentionally not described as clean.

## Review coverage and release follow-up

Existing tests cover parameterized catalog queries, restricted runtime roles, RLS, two-customer isolation, forged sessions, administrator metadata escalation, MFA, CSRF/origin checks, immutable money/snapshots, payment replay and expiry races, outbox leases and provider-event signatures. New checks exercise CSP nonce freshness and injected-script blocking in browsers, streaming limits, outage rendering and aggregate-only popularity.

Hosted checks remain: TLS/CDN behavior, proxy IP trust for Payfast, cross-origin callbacks, Google OAuth, actual mail webhook signatures/retries, upload/delete provider responses, scheduler authorization/lag, secret rotation, retention, abuse limits under real traffic and off-site recovery. Validate deployment headers and verify that owner, service-role, backup and migration credentials are absent from the application runtime. Never enable live purchasing based only on these local checks.
