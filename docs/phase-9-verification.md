# Phase 9 local hardening verification

Owner authorization: “continue phase 9”, 20 October 2026. Hosted services remain deferred. Phase 10, public deployment and genuine purchasing are not approved.

## Scope and changes

Per-request CSP nonces protect framework and theme scripts; private/no-store HTML prevents nonce reuse through shared caching. Request bodies are streamed with limits. Store configuration failures render safe defaults and catalog outages show an unavailable message. A global error boundary avoids exposing diagnostic details.

Popularity now derives from qualifying paid/fulfilled order aggregates without granting the public catalog role access to orders. Test orders, sample products, unpaid/incomplete orders, exceptions and full refunds are excluded. The additive migration is `202610200001_popularity`.

The header wraps at enlarged text sizes. The skip link has an explicit tab stop because Windows WebKit otherwise skips ordinary links during Tab navigation. Search supports native form submission before hydration while retaining debounced updates and existing filters. Preview canonical URLs use the configured origin. Robots/noindex remain enabled and the sitemap is intentionally empty; sample products do not publish structured offers.

## Evidence

- 91 unit/component tests passed.
- 71 PostgreSQL integration checks passed: catalog/migrations 16, accounts 9, checkout 11, payments 12, administration 12, communications/reporting 11.
- Production dependency audit: no known vulnerabilities. Full audit retains one high-severity development-only advisory without a published patch; see the security review.
- Database outage drill passed: homepage renders, catalog reports unavailable, and connection details do not appear in HTML.
- Encrypted recovery drill passed on 20 October 2026 at 12:18 UTC: 33 commerce tables, 157 rows, 6.722 seconds. Compared row digests, policies, constraints and triggers; checked restricted roles and authenticated-encryption tamper rejection. PostgreSQL's equivalent varchar-array/text-array cast serialization is normalized for comparison.
- Browser coverage: all 62 cases passed across the full run and final affected-suite rerun. The full run passed 61/62 in 7.1 minutes and exposed the WebKit skip-link issue. After the explicit tab-stop fix, all 24 foundation/hardening cases passed in 2.5 minutes, including every Firefox/WebKit case. No test was skipped or marked as an expected failure.
- Production build, strict TypeScript, final lint and repository formatting passed. Final build ID: `9hDquIb63r-GlnJKVRmHG`.
- The local preview was restarted on port 3000. Header verification returned HTTP 200, private/no-store, CSP and noindex/nofollow. No hosted deployment was made.

The recovery source was the disposable local test database. A new uniquely named database was restored and removed. The source was unchanged. The report is stored under ignored `.local/recovery/sd_restore_1792498692907_f24a8c12/report.json`. The encryption key was discarded; this drill artifact is not an operational backup.

## Accessibility, browser and performance review

The full customer/administrator journeys run in desktop Chromium and Pixel 7 emulation. Additional hardening checks run in desktop Firefox and iPhone 13 WebKit emulation. They cover script policy, preview SEO, 200% root text sizing, overflow, keyboard skip navigation, Axe checks on policy/auth pages and public-page script payloads. Existing cases cover light/dark themes, reduced motion, focus trapping, 320px reflow, forms and catalog/product accessibility.

Automated Axe scans and emulation do not establish WCAG conformance or replace actual iOS/Android and screen-reader testing. No real-device or assistive-technology acceptance is claimed.

Keyboard checks use Tab and Enter in all three engines. A minimal native-link/button fixture reproduced the Windows WebKit behavior and confirmed that an explicit zero tab index makes the skip link reachable. The application check does not programmatically force focus.

Navigation measurements use an unthrottled local production build. JSON attachments record TTFB, DOM readiness and encoded script bytes for the home, shop and sample-product pages. The script budget is 1 MB per navigation. These are lab diagnostics, not production Core Web Vitals. CDN/network performance, real-user LCP/INP/CLS and operational load remain release checks. Nonce-based dynamic rendering deliberately trades static HTML caching for isolation.

The full-run sample recorded 30–91 ms TTFB and 139–498 ms DOM readiness across these routes and engines. Chromium recorded 210–243 KB of encoded scripts per navigation; the first home navigation recorded 243 KB in every engine. Later WebKit navigations reported lower sizes because of cache behavior, so those values are not treated as complete bundle sizes. This small local sample has no network/CPU throttling and is not a production performance guarantee.

## Release gates

See [security findings](phase-9-security-review.md), [legal content review](legal-content-review.md), [backup/recovery runbook](backup-recovery-runbook.md) and [production readiness](production-readiness.md).

Owner/professional policy signoff, genuine catalog approval, hosted service verification, off-site backup/key recovery, Auth recovery, monitoring, real-device/screen-reader acceptance and explicit launch approval remain outstanding. Local tests do not approve live transactions. No external email, WhatsApp message, card charge or public deployment was performed in Phase 9.
