# ESIMPROVE WP4 Completion Report

## Scope and checkpoint

- **Task:** WP4 — complete the Legal Admin dashboard, connect all legal server actions, harden authorization/audit/privacy behavior, add behavioral tests, and pass quality gates.
- **Branch:** `wp4/legal-dashboard`
- **Approved base checkpoint:** `14fc7d1` — WP3: verify 0006 upgrade path and report pending migrations
- **WP4 implementation commit:** `5edc46c` — WP4: complete legal admin dashboard and compliance workflows
- **Report commit:** the commit that adds this file on `wp4/legal-dashboard`
- **Historical work preserved:** WP1 `916945b`, WP2 `d71e17e`, and WP3 `14fc7d1` are unchanged. No destructive Git commands were used.
- **No deployment, push, DNS change, Netlify change, secret change, or live-service activation was performed.**

## Files changed

| File | Change |
| --- | --- |
| `components/admin-legal-dashboard.tsx` | Replaced the stub with a typed, functional dashboard covering all ten server actions, review forms, notices, empty states, and responsive/keyboard-friendly record editors. |
| `app/admin/legal/page.tsx` | Reads `saved`/`error` query parameters and passes visible success/failure notices to the dashboard. |
| `app/admin/legal/actions.ts` | Added audit outcomes, fixed the privacy success-redirect path, and corrected asset-status validation to accept seeded asset states. All ten actions still authorize before database access. |
| `lib/privacy-requests.ts` | Made review decisions transactional, duplicate-safe, concurrency-safe, and attributable; added audit outcomes; preserved retention-aware deletion. |
| `lib/email-subscriptions.ts` | Made token and administrator unsubscribe idempotent so repeated requests preserve the original evidence. |
| `lib/audit.ts` | Accepts a normal database handle or transaction executor. |
| `lib/db/client.ts` | Added `DatabaseTransaction` and `DatabaseExecutor` types. |
| `lib/legal.ts` | Added the asset-specific review status set used by seeded asset rows; document/accessibility/readiness status validation remains unchanged. |
| `tests/wp4-legal-admin.test.ts` | New 21-test behavioral suite for authorization, legal administration, privacy requests, unsubscribe, and consent regression. |

No `any`, `eslint-disable`, `@ts-ignore`, or `@ts-expect-error` was introduced in the changed files.

## The ten server actions and their dashboard connections

| # | Server action | Dashboard section | Audit action(s) |
| --- | --- | --- | --- |
| 1 | `saveBusinessInfoAction` | Business identity and contacts | `legal.business.updated` |
| 2 | `saveDocumentSettingsAction` | Legal documents, versions, review status, effective dates | `legal.documents.updated` |
| 3 | `saveCookieConfigAction` | Cookie and marketing consent versions | `legal.consent_config.updated` |
| 4 | `saveThirdPartyAction` | Third-party services and data sharing | `legal.third_party.updated` |
| 5 | `saveRetentionAction` | Data retention settings | `legal.retention.updated` |
| 6 | `reviewPrivacyRequestAction` | Privacy request review and decisions | `privacy.request.verified`, `privacy.request.rejected`, `privacy.request.cancelled`, `privacy.request.completed`, `privacy.request.deleted`; `privacy.deletion.no_account` where applicable |
| 7 | `adminUnsubscribeAction` | Email unsubscribe administration | `email.admin_unsubscribe` |
| 8 | `saveAccessibilityReviewAction` | Accessibility review records | `legal.accessibility.updated` |
| 9 | `saveAssetAction` | Asset licensing register | `legal.asset.updated` |
| 10 | `saveReadinessAction` | Legal readiness checklist | `legal.readiness.updated` |

There are no placeholder buttons. Every form submits to one of these actions and every action redirects with a visible `saved=` or `error=` message.

## Dashboard functionality

- **Business identity:** Every owner-supplied field is editable. Missing required fields are listed explicitly; nothing is fabricated. Saving requires an explicit confirmation that the details are accurate and safe to publish.
- **Documents:** Version, review status, and effective date are editable for all five documents. Recorded version history is listed separately. Effective dates are validated as real ISO dates.
- **Consent versions:** Cookie and marketing consent versions are editable and validated against the existing safe character set.
- **Third parties:** Each seeded service opens a native `<details>` editor with provider, purpose, data shared, cookies, transfer notes, consent behavior, necessity, optionality, and configuration notes.
- **Retention:** Each category is editable with day validation (1–36500), basis, notes, and automation controls. Automation is only offered for the two analytics categories that have implemented cleanup. Enabling automation without a period is rejected.
- **Privacy requests:** The list shows reference, type, requester, status, identity state, and timestamps. Details are available only on the administrator page. Open requests expose verify, complete, reject, and cancel forms. Closed requests show a duplicate-processing warning and no decision forms.
- **Unsubscribe:** Administrators can unsubscribe an address with a reason and see recent subscription status. The page states that email delivery remains disabled.
- **Accessibility:** Each review area can be updated. A `complete` status requires a reviewer and findings; the action records `checkedAt`.
- **Assets:** Status, license name/URL, source URL, commercial use, redistribution, attribution, and notes are editable. A `complete` status requires a license reference. Seeded `verified` and `needs_verification` statuses are preserved as valid asset states.
- **Readiness:** Status, owner, and evidence notes are editable. A `complete` item requires evidence notes.
- **Consent evidence:** Recent cookie consents and consent events are displayed with truncated HMAC subject identifiers, not raw identifiers.
- **States:** `useFormStatus` disables submit buttons and shows pending labels; query-parameter notices provide success/failure feedback; every collection has an explicit empty state; validation failures surface the server's message.
- **Accessibility and design:** The existing `.card`, `.form`, `.table-wrap`, `.data-table`, `.badge`, `.button`, and `.alert` styles are reused. Tables are horizontally scrollable on small screens, controls have labels, notices use `role="alert"`/`role="status"`, and record editors use native keyboard-operable `<details>`/`<summary>` elements.
- **Missing data:** The dashboard counts unresolved assets, open privacy requests, incomplete readiness items, and missing required business fields without inventing legal or business information.

## Authorization

Every one of the ten actions begins with:

```ts
const admin = await requireAdmin("/admin/legal");
```

before reading form data or opening the database. The guard enforces:

- Anonymous sessions → `/login?next=%2Fadmin%2Flegal`
- Customer sessions → `/portal`
- Sessions pending two-factor authentication → `/login/2fa`
- Authorized administrator or super-administrator sessions proceed

The tests execute all ten actions as an anonymous visitor and as a customer. Both runs are rejected and leave the audit count and legal settings unchanged. UI hiding is not relied on for security.

## Audit trail

Each successful administrative operation writes an audit row with:

- `actorType: "admin"`
- `actorId`: the authenticated administrator's user ID
- `action`: the operation name listed above
- `entityType` and `entityId`: the target record
- `createdAt`: automatic timestamp
- `metadata.outcome: "success"`

Metadata records configuration state and booleans rather than personal data. In particular, a rejection stores `rejectionReasonRecorded: true`; the reason remains on the privacy request row and is not duplicated into the audit trail. Deletion audits record `deleted`, `retainedFinancialRecords`, and the request reference.

Privacy reviews run inside `db.transaction(...)`. The request is claimed with a conditional update that excludes completed, rejected, and cancelled rows; the audit and any deletion succeed or roll back together. This prevents two administrators from processing the same request concurrently.

## Privacy request workflow

1. **Submission and lookup:** Requests are created with status `pending_verification`. Public lookup requires both the reference and the matching email address; a wrong email or unknown reference returns nothing.
2. **Administrative visibility:** Full request details, requester details, notes, resolution, and rejection reason are rendered only on the authorized admin page.
3. **Verification:** An administrator can mark identity verified. The request moves to `in_review`, records `verifiedAt` and `handledBy`, and writes an audit row.
4. **Completion:** Completion requires verified identity. Deletion requests additionally require the explicit `confirmDeletion` confirmation. Unverified requests cannot be completed.
5. **Deletion safeguards:** The request row is claimed first inside the transaction, then `performRetentionAwareDeletion` anonymizes the account email/name/password, removes TOTP, sessions, password resets, notifications, and user consents, disables marketing preferences, and unsubscribes linked email subscriptions. Orders, payments, invoices, refunds, and audit records are retained for legal/financial recordkeeping. Any failure rolls the transaction back, leaving the request open.
6. **Manual actions:** Access and portability requests require a manual response before completion; the resolution field records what was delivered.
7. **Duplicate processing:** Closed requests reject further decisions. A concurrent status change produces an error asking the administrator to reload.
8. **Failure handling:** Errors are converted into a visible `?error=` notice; success redirects are now outside the failure path, so a completed decision no longer appears as an error.

## Unsubscribe behavior

- A valid token finds the subscription by HMAC hash and moves it to `unsubscribed`.
- Invalid, short, or unknown tokens return no subscription and fail safely.
- Repeated token or administrator unsubscribe requests are idempotent: the original timestamp and reason are preserved.
- Administrator unsubscribe returns a clear error when no matching address exists.
- The action writes `email.admin_unsubscribe` with the administrator ID and outcome.

## Tests added

`tests/wp4-legal-admin.test.ts` contains 21 tests:

- **Authorization:** anonymous and customer rejection for all ten actions, with unchanged audit and settings state.
- **Legal administration:** business details, document versions/history, invalid document status, consent versions, third-party updates, retention success and three validation failures, accessibility completion evidence, asset status handling (including seeded `verified`), readiness evidence, and audit actor/outcome checks.
- **Privacy requests:** submission, reference+email lookup, wrong-email isolation, unauthorized review denial, verification, completion, duplicate verification/completion rejection, rejection-reason handling, no free-text reason in audit metadata, unverified deletion rejection, and retention-aware deletion with session/subscription cleanup and retained records.
- **Unsubscribe:** valid token, invalid/short tokens, idempotent token behavior, administrator action, repeated administrator behavior, unknown address, and audit record.
- **Consent regression:** `/api/track` still returns `204` when server-side consent evidence is missing.

Existing consent tests in `tests/phase4-access.test.ts` remain unchanged and continue to pass.

## Quality gates

| Gate | Command | Result | Evidence |
| --- | --- | --- | --- |
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **Exit 0**, zero errors | `.audit/wp4-final-typecheck.txt` |
| ESLint | `npm run lint` (`eslint .`) | **Exit 0**, zero errors, zero warnings | `.audit/wp4-final-lint.txt` |
| Full tests | `npm test` (`vitest run`) | **Exit 0**, 21 files passed, 209 tests passed | `.audit/wp4-final-test.txt` |
| Targeted WP4 tests | `npx vitest run tests/wp4-legal-admin.test.ts` | **Exit 0**, 21 tests passed | `.audit/wp4-targeted-test-2.txt` |

The suite grew from the previous 188 passing tests to 209 passing tests. No existing test was weakened or skipped.

## Database and secret protection

- The original `.pglite` directory was not modified. It remains at **1,281 files / 60,039,363 bytes**, with its newest file timestamp on **2026-11-06**, before WP1–WP4 work.
- WP3's recorded aggregate SHA-256 evidence remains `2d399169620530c3d5c8f015aedba18b8994fac625a3273a3d1434d3e247acea` in `.audit/wp3-original-hash-before.txt` and `.audit/wp3-original-hash-after.txt`.
- `.env.local` and secrets were not read, printed, or modified.
- Netlify configuration, CSP, rate limiting, analytics secrets, retention behavior, and production infrastructure were not changed.
- `.audit/` remains untracked command evidence and is not part of the WP4 commit.

## Remaining limitations and owner-dependent actions

- **Email delivery is disabled.** Privacy verification/status messages and unsubscribe links cannot be sent by this build. Identity verification is performed out of band by an administrator, and unsubscribe delivery with a real provider remains blocked.
- **Access/portability responses are manual.** The dashboard records the resolution but does not assemble or transmit a data export.
- **Non-analytics retention remains manual.** Only raw analytics events and analytics aggregates have implemented cleanup. Other categories are configuration records until an approved job exists.
- **Browser-level accessibility validation is pending.** WP4 implements keyboard semantics, labels, and status announcements and passes TypeScript/ESLint/behavioral tests, but no Playwright or axe browser audit was run because WP7 requires explicit approval before installing those dependencies.
- **No legal conclusion is made.** Document review statuses and readiness items are administrative records; owner and qualified legal review remain required.
- **Production prerequisites remain BLOCKED:** Netlify deployment, production PostgreSQL, domain/DNS/HTTPS, production secrets/KEKs, scheduler, backup/restore, monitoring, media host, live providers, Google Search Console, legal/tax approval, and production analytics.

WP4 is complete at commit `5edc46c` plus this report commit. Work stops here; WP5 has not been started.
