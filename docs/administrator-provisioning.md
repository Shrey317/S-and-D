# Administrator provisioning and recovery

No public form, user metadata or customer profile field can grant administrator access. The application reads an operator-managed `AdministratorGrant` and verifies the authenticated JWT's AAL2 claim. Every future admin operation must call the server authorization guard; displaying an admin link is never sufficient authorization.

## Provision the sole owner

1. Have the owner register and confirm the approved email. Verify their identity through the approved operator channel.
2. The owner signs in, opens account security, enrolls an authenticator, stores its setup/recovery information privately, and verifies a code. Do not request or record their password or authenticator secret.
3. From a controlled operator environment only, configure `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_ADMIN_KEY`. The last value is a Supabase secret/service-role key and must never be in the application runtime environment, browser, source control or chat.
4. Use the Auth UUID verified in the project. Run `pnpm admin:provision grant <auth-uuid> "Owner identity reviewed; initial grant"`. The script requires a confirmed non-anonymous identity, a verified TOTP factor, and no different administrator grant. No public endpoint invokes it.
5. Record the UUID, reviewed reason, operator, time and outcome in the restricted operating log. Sign in and complete MFA, then verify `/admin` shows Store overview after [administration setup](administration-setup.md). Without the administration database configuration it shows the verified-access setup message.
6. Remove the privileged credentials from the operator shell after use. Keep a separate tested owner recovery process and project access recovery method.

The grant/revoke script is implemented; no real store administrator was provisioned. Automated tests use temporary local identities and remove their grants afterward.

## Revoke, transfer or recover

- To revoke application admin access: `pnpm admin:provision revoke <auth-uuid> "Reviewed revocation reason"`. Also revoke Auth sessions from the controlled Supabase operator interface when compromise is suspected. Revoke first before a transfer, because the script enforces one administrator.
- For a lost authenticator, independently verify the owner's identity. Suspend/revoke admin access, revoke sessions, and reset only the verified owner's factors through Supabase's operator controls. The owner must re-enroll and verify a fresh authenticator before a new grant is allowed. Never bypass AAL2 temporarily to keep an old session working.
- A password reset does not remove an enrolled authenticator or grant administrator rights. No emailed recovery link alone authorizes an administrator transfer.
- Review exported logs, backups and local test artifacts for secret exposure. Runtime Phase 7 audit records cover store actions; grant/revoke infrastructure operations retain the separate restricted operator log. Formal operator-log retention and recovery evidence remain production gates.

Hosted provisioning, recovery drills, SMTP, OAuth and MFA on a real device remain launch gates. Local tests establish the authorization boundaries, not operational ownership or production readiness.
