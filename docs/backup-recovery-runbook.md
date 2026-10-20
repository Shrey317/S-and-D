# Backup, recovery and incident preparation

Phase 9 prepares and exercises local recovery. No hosted backup, off-site storage or recurring job has been configured.

## Local drill

Run `pnpm recovery:local` after the test database suites finish and before browser tests start. It accepts only the isolated loopback `sd_catalog_test` source. It creates a uniquely named new `sd_restore_*` database; it never restores over development, test or production databases.

The drill takes a PostgreSQL custom-format dump, encrypts it with AES-256-GCM, removes the plaintext dump, authenticates/decrypts it, restores into the new database, and compares every commerce table's count/digest plus policies, constraints and triggers. It checks restricted catalog/worker roles and rejects a modified archive. Plaintext working files and the new database are removed afterward. A report and encrypted drill artifact remain under ignored `.local/recovery`. The key is ephemeral and discarded: **this artifact is evidence of a drill, not an operational backup**.

Existing cluster roles are reused, so this does not prove recovery of roles on a fresh host. It also does not cover the separate local Supabase Auth database, authenticator enrollment recovery, Cloudinary assets, hosted extensions/poolers or external provider state. Use synthetic data only for the drill. See [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) and [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

## Before live orders

The owner must approve recovery-point/recovery-time targets, backup frequency, retention, an encrypted off-site destination, key custody, restoration access and an incident contact. Record the choices; no default free-provider backup is assumed. A separate operator must be able to recover the key without relying on the failed application host.

Back up the application schema and migration history with a consistent snapshot using a dedicated backup identity that can read all required RLS-protected data. Do not use the storefront reader: it intentionally cannot see private commerce tables. Preserve role definitions/grants without exporting passwords, provisioning procedures, deployment/environment variable **names**, configuration/policy versions, asset manifests and required original media. Back up or arrange supported recovery for Supabase Auth separately. Treat dumps, identity exports and keys as confidential; never attach them to Git, chat or browser test reports.

Store checksums, UTC backup time, migration/build revision, row counts and restore verification separately from secret values. Encrypt before upload, verify remote retrieval, alert on missed backups and periodically restore into an isolated new environment. A successful upload alone is not recovery evidence.

## Restore and reconciliation

1. Disable ordering, scheduled workers and outgoing notifications. Preserve the failed database and logs; do not erase evidence.
2. Provision a fresh isolated target and the required roles/extensions. Restore the snapshot and validate migrations, constraints, RLS, grants and data totals before application access.
3. Restore identity/configuration/asset dependencies through their supported procedures. Rotate compromised credentials. Confirm administrator grant, AAL2 and recovery procedures.
4. Verify outstanding reservations, consumed stock, order/payment/refund balances and external provider receipts. A snapshot can predate real receipts, refunds and deliveries; reconcile them before reopening. Never blindly replay Payfast events or resend uncertain emails.
5. Expire stale worker leases safely. Preserve idempotency references and the email provider's retry-window limits. Review old pending/review messages before resuming outbound work.
6. Run ownership/role tests and representative read-only order checks. Record achieved data-loss interval and elapsed recovery time against the approved targets. Reopen only after operator/owner acceptance.

## Rollback and incident handling

Prefer code rollback with forward-compatible migrations. Do not drop payment, stock, audit or communication tables. Preserve promotion snapshots and consumed reservations. If a release writes data older code cannot interpret, suspend ordering and roll forward with a repair instead of reverting the database.

For suspected credential compromise, suspend affected operations, revoke/rotate credentials, preserve limited audit evidence and involve the responsible operator. For payment uncertainty, retain all receipts and reconcile externally before fulfilment/refund. For an outbox backlog, inspect leases, attempts and delivery events before retrying. For catalog/database outage, show unavailable stock and keep checkout fail-closed.

Monitoring before launch must include uptime, database/storage capacity, backup freshness, worker backlog/oldest pending age, expired holds, payment exceptions, mail failures and provider quota alerts. Assign an owner and response procedure for each signal. These are release gates, not configured services.
