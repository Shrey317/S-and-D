# Communications and reporting operations

Phase 8 is implemented for local verification. No hosted Resend configuration, external email, WhatsApp message, public deployment or real transaction has been performed. The owner deferred hosted services. The local worker captures email content in the private administrator interface.

## Local setup

Apply `pnpm db:migrate`, then run `pnpm communications:local`. The helper creates a separate `sd_communications` login inheriting `sd_communications_worker`, writes the two worker database URLs to the ignored local environment, and enables `EMAIL_CAPTURE_ENABLED=true`. It preserves existing credentials and does not enable `EMAIL_ENABLED`. Rebuild/restart after environment changes. Keep local capture and hosted delivery mutually exclusive.

Create a local test order, sign in as the provisioned MFA administrator, and open Notifications or Communications. Order creation saves an unread alert and customer/admin email records in the same database transaction. Payment confirmation, fulfilment completion, cancellation/expiry, completed refunds and payment exceptions create the appropriate later records. Existing historical orders are not backfilled, preventing old notices from suddenly being sent.

Use **Capture next 10 queued emails locally** or `pnpm email:work`. Open an email record to review its frozen content, attempts and status. `CAPTURED` means retained locally, not sent. Local test orders always use capture, even if hosted delivery is configured later. The worker never calls the provider while committing an order/payment/stock transaction. A database enqueue failure rolls back the event transaction rather than silently losing its notification.

## Email state and retry behavior

The worker claims rows with `FOR UPDATE SKIP LOCKED`, a two-minute lease and a random fencing token. Each claim records an attempt. Expired leases can be reclaimed; a late worker cannot overwrite the current lease result. Content, sender, recipient and delivery mode are frozen before the first send and reused with a stable key `sd-email/<message UUID>`.

Retryable network/provider errors use exponential backoff, up to six attempts and less than 23 hours from the first claim. A batch claims at most 20 messages, normally ten, with a 45-second scheduling budget and ten-second provider request timeout. An in-flight request may extend the batch past its scheduling budget. Processing is bounded and designed for repeated worker invocations, not an indefinitely running web request.

`ACCEPTED` means the provider accepted the request, not that a customer received it. `PENDING` with a prior attempt may have an uncertain external result; retry uses the same frozen payload and key. `FAILED` means rejected/invalid/suppressed and stops automatic attempts. `REVIEW` stops automatic processing when the retry count or safe time window is exhausted. Review and failures create administrator alerts. Resend retains idempotency keys for 24 hours; automatic retries deliberately stop sooner. See [Resend idempotency guidance](https://resend.com/docs/dashboard/emails/idempotency-keys).

Do not reset an uncertain message's attempt count or reuse its key after the provider window. An operator must inspect the provider record and reconcile acceptance before deciding whether another copy is justified. The UI permits an explicitly acknowledged extra copy of a captured, accepted or failed customer notice; it blocks additional copies of pending/processing/review records. An extra copy is a new message and can duplicate one the customer already received. Bounced, complained or provider-suppressed recipients remain blocked from future hosted sends. Clearing suppression requires a separately reviewed operator process; no public/customer action can clear it.

## Hosted Resend configuration — not yet verified

After owner approval for hosted service setup, verify the sender domain and mailbox, then configure `EMAIL_ENABLED=true`, `EMAIL_CAPTURE_ENABLED=false`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `RESEND_WEBHOOK_SECRET` and `COMMUNICATIONS_DATABASE_URL`. Use the restricted worker login, never the migration owner. Keep sender/recipient configuration server-only. Auth verification/password-reset mail remains the separate Supabase SMTP integration.

Register `POST /api/email/events` for supported email lifecycle events. The endpoint verifies the unmodified request body through the Resend SDK using the Svix ID, timestamp, signature and webhook secret; it rejects oversized payloads and invalid signatures. Configure email sent, delivered, delayed, bounced, complained, failed and suppressed events. Duplicate event IDs are idempotent; contradictory duplicates are rejected. Valid early events are retained even if local acceptance has not yet committed. Only minimal event metadata is stored, not the raw signed payload.

Negative delivery outcomes remain visible even if a sent/delivered event arrives later. Delivered means acceptance by the recipient mail server, not proof of reading. Matched failure events create review alerts. See [official webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

For scheduling, invoke `pnpm email:work` from a controlled worker environment, or call `POST /api/jobs/email` using `Authorization: Bearer <COMMUNICATIONS_WORKER_TOKEN>`. Use a random token of at least 32 characters in server secrets. The endpoint has no public GET operation and fails closed when unconfigured. Configure the approved scheduler to invoke it repeatedly (for example once per minute), with a timeout allowing the bounded batch to finish. No public scheduler or hosting function was deployed in this phase. Hosted scheduler, missed-run recovery, provider timeouts, sender delivery/reputation and actual webhook retries remain launch tests.

The worker can read its communication records and update processing state, attempts and notifications. It cannot read the Order/CustomerProfile tables, modify money, grant access, delete messages or rewrite event payloads. Trigger functions enqueue notices with a fixed search path and are not executable by public/runtime callers. Admin pages and export/action entry points independently require the operator grant and AAL2.

## Manual WhatsApp confirmations

Open an order and choose **Prepare WhatsApp confirmation**. The app saves an exact draft containing validated contact, order ID, amount, fulfilment and current statuses. Review it, then use **Open WhatsApp draft in a new tab**. This records `OPENED` and opens click-to-chat; no message is automatically transmitted.

After personally sending that exact draft in WhatsApp, return, refresh the page and choose **Mark manually sent**, with the attestation and reason. The resulting `MARKED_SENT` state is an administrator statement, not verified recipient delivery. Prepared/opened/marked-sent actions have separate audit records. If the order changed, prepare a fresh draft instead of sending outdated information. Test drafts are visibly labelled local tests. Browser tests intercept the WhatsApp destination so no external request or message is sent.

The new-tab handoff uses a native authenticated POST with the same strict origin check and MFA authorization as other admin mutations. The draft page sets a `same-origin` referrer policy so the browser supplies the origin for that same-site form submission while withholding referrer details from external destinations. A blanket `no-referrer` policy makes native form origins null; see [MDN referrer policy behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy). The redirect also specifies `no-referrer` and the form isolates the new tab with `noopener`.

## Reports and Excel workbooks

Reports accept inclusive Johannesburg dates spanning at most 366 days. Sales include real paid/fulfilled orders with exact verified receipts and no payment exception. Full refunds remain in gross/refund reporting with zero net; partial refunds reduce net. Test, unpaid, cancelled and exceptional orders are excluded. Refunds are reported as of generation against the original order date, not as a cash-movement ledger by refund date. This makes historical net sales change when a later refund completes.

Daily/monthly tables and the Recharts chart share the same server calculation. Charts use numeric presentation values; exact amounts in tables and exports derive from integer cents. Bestsellers count packs in qualifying orders with positive remaining net sales. Partial monetary refunds contain no returned-unit detail, so they do not invent quantity reversals.

The ExcelJS workbook contains Summary, Daily sales, Monthly sales, Bestsellers, Orders, Order performance, Inventory and Customers sheets, with frozen headers, filters and currency formats. Workbook totals are written from the same report snapshot; customer text is stored as inert strings with formula-prefix protection. There are no active formulas or external links. Exports are authenticated, audited, attachment downloads and private/no-store.

Order performance groups all real orders created within the selected dates by current fulfilment status and delivery/collection method, including unpaid, cancelled and expired records. It excludes tests and is explicitly separate from sales qualification; its counts do not claim revenue or elapsed fulfilment time.

Inventory and customer contact records are current at generation; customer spending uses the selected order-date range. Reads share a repeatable-read database snapshot. Reports stop if a source exceeds 5,000 rows rather than silently truncating exported data. Workbooks contain private customer information: keep them only for the approved business purpose, restrict sharing and follow the eventual approved retention policy. No workbook is sent or uploaded automatically.

## Verification and rollback

Run `pnpm test:db` to prepare the exact disposable local database, then account, checkout, payment, administration and communications suites. `pnpm test:communications` exercises actual worker/admin/commerce roles, atomic enqueue/rollback, replay, concurrent claims, lease recovery/fencing, safe retries, early/duplicate delivery events, suppression, manual communication states, report eligibility and workbook cells. Provider calls are explicit stubs; protocol tests use independently signed webhook fixtures. Run unit tests, lint, production build and browser checks afterward.

Migration `202610190002_communications` is additive, including SQL triggers and append-only source records. Preserve communication history and queued events on rollback. To pause outbound mail, disable hosted delivery and local capture, disable the scheduler and keep the database tables/triggers. Do not delete records or blindly replay the backlog when re-enabling. Before launch, verify event retention, role grants, monitoring, scheduler lag, provider reconciliation and restore of leases/messages alongside orders. Hosted delivery and recovery evidence remain outstanding.

Implementation references: [React Email rendering](https://react.email/docs/utilities/render), [Recharts installation](https://recharts.github.io/en-US/guide/installation/), and [ExcelJS workbook documentation](https://github.com/exceljs/exceljs#writing-xlsx).
