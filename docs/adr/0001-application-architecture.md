# ADR 0001 — One Next.js application with server-owned commerce logic

Date: 14 October 2026. Status: accepted for Phase 1; production integrations remain subject to their phase acceptance checks.

## Context

S & D Fruit and Veg needs a commercial catalog/order/payment/admin system for roughly 30 initial products, one administrator and Lenasia fulfilment. The owner confirmed Next.js, Supabase PostgreSQL/Auth, Prisma, Cloudinary, Resend and Payfast, with R0 fixed infrastructure preferred and phased approval required.

## Decision

Use one Next.js App Router application. Domain services own financial/inventory transitions. PostgreSQL is the authoritative store. Customer authorization occurs in server data access; private database schema grants/RLS block direct browser access. Runtime Prisma does not impersonate customer JWTs. Separate migration privileges.

Use Netlify Free as initial commercially permitted candidate, with explicit quota/availability risks and later hosted verification. Retain portability by keeping platform schedules thin and business jobs in ordinary server modules. Do not use a static export for the eventual commerce application.

Use decimal-safe amounts, fixed purchasable variants, immutable order snapshots, transactional stock allocations, idempotency and an outbox. Treat payment, lifecycle and fulfilment independently. Payfast redirects are presentation only. WhatsApp remains manually sent. Non-VAT status and no same-day guarantee are confirmed defaults.

Foundation runs without external credentials. Validate enabled-service configuration and redact failures. Live payment mode is forbidden in Phase 1. Add dependencies in the phase that uses them. Full dark-mode behaviour, storefront design and integration implementations are excluded from Phase 1.

## Consequences

Operational simplicity and one deployment fit the business scale. Server application bugs could cross customer boundaries even with RLS, so ownership tests are mandatory. Serverless database pooling, payment callback source verification and scheduled recovery need real-host verification. Free quotas can interrupt sales; backups and paid-upgrade decisions are operational prerequisites.

## Alternatives

Microservices, Redis, external search and paid WhatsApp API add unjustified early cost/complexity. Static-only hosting cannot supply the required secure commerce backend. A Sites-specific runtime would replace the approved stack/hosting assumptions, so no Sites project is registered. Paid hosting remains a later owner-approved option if free limits or reliability are unacceptable.
