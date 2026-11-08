# Security & Operations Notes (Phase 6 Harden & Launch Gates)

Status system: PASS / FAIL / BLOCKED / NOT DONE / NOT APPLICABLE

## 1. Production route smoke test (PASS, verified)
- File: `scripts/smoke-test-production.ps1`.
- Verifies build artifacts (`/admin/monitoring/page.js`, etc.), starts server with `npm start`, waits bounded, tests 4 admin routes, distinguishes expected auth redirect (200 or 3xx→login) from unexpected 404/500. Cleans up only the PID it started. Returns nonzero on unexpected results.
- Result run: PASS — all 4 routes 200 rendered; no 404/500; only PID cleaned. Log at `smoke-test.log`.

## 2. Test coverage classification (61/61 reproduced)
- Classification in `ESIMPROVE_TASK_VERIFICATION_REGISTER.md` Test Coverage Classification section.
- All external services are mock/demo: supplier adapter, payment provider, webhook endpoint, catalog sync, email delivery are mocked. Tests prove local logic integrity, schema/order/audit integrity, idempotency on the mock webhook, and access rules — none prove verified live integrations or deployment runtime behavior.
- Coverage assertion limited to local/unit level; does not imply supplier/Whop/SMTP/shipping/legal.

## 3. Whop webhook hardening (BLOCKED, plan documented)
- Existing safeguards: `lib/payments.ts` `handlePaymentWebhook` + `webhookEvents` hash replay protection; `whop.ts` rejects without secret; fulfillment gated by state transition.
- Test plan documented in `docs/whop-webhook-hardened.md`. Live verification BLOCKED until `WHOP_COMPANY_API_KEY` + `WHOP_WEBHOOK_SECRET` obtained, eligibility confirmed, and official signature algorithm implemented. No invented algorithm.

## 4. Secrets management
- `.env.local`: NOT tracked by git; present locally for demo use only.
- `.env.example`: tracked; placeholder values only.
- No secrets present in any tracked source file or report.

## 5. Authentication & rate limiting
- Server-side guard (`lib/auth/guards.ts`) enforced; password reset flows preserved.
- Rate limiting helpers exist; review login, registration, password reset, sensitive admin endpoints; suitable protection compatible with existing architecture where safe; customer-data isolation preserved.
- Credentials used in demos are placeholder secrets and remain demo-only.

## 6. Error tracking & uptime monitoring
- Not configured. Documented requirement: integrate Sentry / production error tracker and uptime service; configure with credentials and verify before launch.

## 7. Database migrations & rollback
- Migration scripts reviewed; no destructive changes introduced; no production migrations executed against live data. Documented sequence: set prod DB → `npm run db:migrate` → test restore against disposable DB.
- Restore test not performed (no disposable DB available). Procedure documented; blocker noted.

## 8. Backup and restore
- No automated backup procedure configured; `.pglite` demo data not transferable to production safely. Restore test not performed; BLOCKED until backup tooling acquired and tested.

## 9. eSIM fulfillment failures / refunds / support
- Retry limits enforced; duplicate-fulfillment prevention via outbox idempotency; order states gated; notifications via supplier adapter throw paths.
- Refund handling is business-policy controlled (`approveRefundAction`); automatic refund never promised unless code supports it.

## 10. Legal policies alignment
- Terms, privacy policy, refund policy, FAQ checked for alignment with checkout behavior. Jurisdiction-specific review required but not performed — BLOCKED pending legal review.

## 11. Release gates (production launch)
- Supplier authorization + successful test fulfillment: BLOCKED (no credentials)
- Whop sandbox checkout + signed webhook processing: BLOCKED (no credentials)
- Database migration + tested restore procedure: BLOCKED (restore test not done)
- Domain, HTTPS, production environment config: BLOCKED (unverified)
- Authentication rate limiting + security checks: BLOCKED (external monitoring not configured)
- Failed-fulfillment and refund workflow: verified conceptually / BLOCKED live test
- Legal policy review: BLOCKED (not performed)
- External monitoring and alert delivery: BLOCKED (not configured)
- Production route smoke tests: PASS (automated script verified)
- Rollback readiness: documented, not tested — BLOCKED until rollback tested against an actual deploy
