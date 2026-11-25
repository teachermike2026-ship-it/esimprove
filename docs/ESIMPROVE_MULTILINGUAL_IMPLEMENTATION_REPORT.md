# ESIMPROVE Multilingual Implementation Report

**Date:** 24 November 2026  
**Scope:** Local implementation of Spanish, Arabic, and French across the ESIMPROVE Next.js site, with English preserved as the default.  
**Status:** Implementation and local verification complete. No deployment was performed.

---

## 1. Summary

The site now supports four languages:

| Locale | Code | Native name | Direction | Canonical URL shape |
| --- | --- | --- | --- | --- |
| English (default) | `en` | English | LTR | `/`, `/plans`, `/login` |
| Spanish | `es` | Español | LTR | `/es`, `/es/plans`, `/es/login` |
| Arabic | `ar` | العربية | RTL | `/ar`, `/ar/plans`, `/ar/login` |
| French | `fr` | Français | LTR | `/fr`, `/fr/plans`, `/fr/login` |

English keeps its existing unprefixed URLs and remains the default and canonical language. Non-English locales use a URL prefix, while the existing Next.js route files remain in place. The proxy rewrites prefixed requests internally, so no page directory was duplicated or moved.

The implementation includes:

- A single locale registry and shared dictionaries.
- Localized public, authentication, checkout, customer portal, legal-navigation, error, and empty/loading UI.
- A site-wide language selector, including the mobile navigation panel.
- Arabic RTL layout support.
- Locale persistence through a cookie.
- Localized metadata, canonical URLs, hreflang, `lang`, and `dir`.
- Localized operational status and support labels.
- Translation-completeness and URL regression tests.

---

## 2. Architecture

### 2.1 Locale registry

`lib/i18n/config.ts` defines the supported locales, native names, text direction, HTML language tags, Open Graph locales, the locale cookie, and URL helpers.

Key behavior:

- `locales = ["en", "es", "ar", "fr"]`
- Default locale is `en`.
- Arabic is the only RTL locale.
- `localizedHref(path, locale)` produces unprefixed English URLs and prefixed non-English URLs.
- `splitLocalePath(pathname)` separates a supported locale prefix from the route path.
- `absoluteLocalizedUrl(path, locale, base)` builds canonical and hreflang URLs.

### 2.2 Request routing and locale selection

`proxy.ts` performs the locale-aware request handling:

1. Reads a supported locale prefix, if present.
2. Falls back to the saved locale cookie.
3. Falls back to English.
4. Rewrites `/es/...`, `/ar/...`, and `/fr/...` to the existing unprefixed route files.
5. Passes the active locale to the server tree through `x-esimprove-locale`.
6. Persists the selected locale in `esimprove_locale` for one year.
7. Redirects `/en/...` to the canonical unprefixed English URL and resets the cookie to English.
8. Keeps localized redirects and `/en` redirects `Cache-Control: no-store` so `Set-Cookie` is not lost.
9. Preserves the existing CSP nonce, configuration check, and authenticated-area session gate.
10. Redirects anonymous `/es/portal`, `/ar/portal`, etc. to the localized login page with the localized return path.

Unsupported locale-like prefixes such as `/de/plans` are not treated as locales and continue to return the existing 404 response.

### 2.3 Server and client translation access

- Server components use `getI18n()` from `lib/i18n/server.ts`.
- Client components use `useI18n()` from `components/i18n-provider.tsx`.
- `createTranslator()` supports `{placeholder}` interpolation and leaves unknown placeholders visible for review.
- `getDictionary()` falls back to English for an unknown locale.
- Admin routes are detected by `isAdminPath()` and always render in English.

### 2.4 Dictionary organization

English is the source dictionary in `lib/i18n/dictionaries/en.ts`. Each translated locale is split into four files:

- `common.ts`
- `public.ts`
- `account.ts`
- `content.ts`

Each locale aggregator spreads those files into a typed `Record<TranslationKey, string>`.

**Dictionary completeness:** each locale has **1,251 keys**, identical key sets, no empty values, and matching interpolation placeholders. This is enforced by `tests/i18n.test.ts`.

---

## 3. Files Changed

### 3.1 New i18n module (24 files)

- `lib/i18n/config.ts`
- `lib/i18n/translate.ts`
- `lib/i18n/server.ts`
- `lib/i18n/metadata.ts`
- `lib/i18n/status.ts`
- `lib/i18n/labels.ts`
- `lib/i18n/dictionaries/index.ts`
- `lib/i18n/dictionaries/en.ts`
- `lib/i18n/dictionaries/es/{index,common,public,account,content}.ts`
- `lib/i18n/dictionaries/ar/{index,common,public,account,content}.ts`
- `lib/i18n/dictionaries/fr/{index,common,public,account,content}.ts`

### 3.2 New components and tests

- `components/i18n-provider.tsx`
- `components/language-switcher.tsx`
- `tests/i18n.test.ts`

### 3.3 Updated application files

The multilingual work modifies **79 existing tracked files** (excluding unrelated pre-existing audit documents in the working tree). The main areas are:

- **Root layout and routing:** `app/layout.tsx`, `proxy.ts`, `lib/auth/guards.ts`
- **Shared UI:** header, footer, brand mark, icons, cards, filters, search, forms, legal document shell, order detail, status badge, copy button, activation card, analytics/consent UI
- **Public pages:** home, about, contact, destinations index/detail, plans index/detail, regions index/detail, search, compatibility, guides index/detail, blog index/detail/category/tag
- **Auth pages:** login, login 2FA, register, forgot password, reset password, verify email
- **Commerce:** cart, checkout, payment, success, order detail, order eSIM activation
- **Customer portal:** portal home, profile, support list/ticket, order detail, eSIM activation
- **Legal:** legal index/layout, terms, privacy, refunds, cookies, accessibility, FAQ
- **Other flows:** privacy request, unsubscribe, refund request
- **States:** `app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx`
- **Styling:** `app/globals.css`

### 3.4 Explicitly unchanged

- Admin pages and admin actions remain English-only operational surfaces.
- No database schema, migration, or seed changes were made.
- No dependencies were added or upgraded.
- No credentials, 2FA configuration, DNS, hosting, or deployment settings were changed.

---

## 4. Translation Coverage

| Area | Coverage |
| --- | --- |
| Site header, footer, navigation, language selector | Full UI translation; mobile selector included |
| Homepage and homepage client components | Full UI translation |
| Destinations, plans, regions, search, compatibility | Full UI and metadata translation |
| About, contact, guides index, blog shell | Full UI and metadata translation |
| Login, register, forgot/reset password, 2FA, verify email | Full UI translation |
| Cart, checkout, payment, success, order detail, activation | Full UI translation |
| Portal, profile, support, portal orders, portal eSIM | Full UI translation |
| Legal navigation, headers, summaries, notices | Translated |
| Legal long-form body and legal FAQ items | English-authoritative, with localized notice |
| Blog article body | English-authoritative, explicitly marked `lang="en" dir="ltr"` |
| Guide bodies | English-authoritative, with localized notice |
| Error, loading, and not-found states | Translated |
| Status labels, support categories, priorities | Translated through `status.*`, `support.cat.*`, and `support.priority.*` |
| Cookie consent UI | Translated |
| Admin UI | English-only by design |
| Server-generated validation and action errors | English (see Limitations) |
| Transactional emails | English (see Limitations) |

### 4.1 Translation quality

- Spanish, Arabic, and French dictionaries are complete for the implemented UI.
- Arabic copy is written in Modern Standard Arabic for interface labels and operational messages.
- Native-speaker review is still recommended before a public launch, especially for legal-adjacent and support wording.

---

## 5. Arabic RTL Details

Arabic pages set `<html lang="ar" dir="rtl">`. The RTL stylesheet section in `app/globals.css` covers the remaining physical-side rules that flex/grid mirroring does not handle automatically.

Implemented RTL behavior:

- Arabic font stack using Noto Naskh Arabic, Noto Sans Arabic, Segoe UI, Tahoma, and Geeza Pro fallbacks.
- Letter-spacing reset for Arabic text so glyph joining is not broken.
- Header actions, account menus, cart totals, and dropdowns anchored to the correct side.
- Language menu, account menu, and mobile navigation panel mirrored for RTL.
- Mobile menu links, table cells, definition lists, and card rows aligned with `text-align: start`.
- Breadcrumb separators and custom list markers moved to the right side.
- Check-list markers and search CTA padding mirrored.
- Navigation arrows using `.icon-arrow` mirrored with `transform: scaleX(-1)`.
- Prices, price lines, ICCID/activation codes, order numbers, coupon codes, emails, telephone/URL inputs, `pre`, and `code` isolated as LTR with `direction: ltr` and `unicode-bidi: isolate`.
- Arabic status pill spacing adjusted for narrow screens.
- Mobile language selector remains visible inside the mobile navigation panel at widths up to 1000px.

Verified RTL properties:

- Arabic pages report `dir="rtl"` at the document root.
- Arabic plan prices report `direction: ltr`.
- Directional arrows report `matrix(-1, 0, 0, 1, 0, 0)` in Arabic.
- No horizontal overflow was found at 390px mobile width or 1440px desktop width.
- The mobile language menu opens inside the viewport and lists all four locales.

---

## 6. SEO

### 6.1 Document language and direction

`app/layout.tsx` sets:

- `lang="en" dir="ltr"` for English
- `lang="es" dir="ltr"` for Spanish
- `lang="ar" dir="rtl"` for Arabic
- `lang="fr" dir="ltr"` for French

### 6.2 Canonical URLs

- English pages keep the existing unprefixed canonical URL.
- Spanish, Arabic, and French pages use their prefixed canonical URL.
- `/en/...` is a redirect, not a canonical URL.

Examples:

- English plans: `/plans`
- Spanish plans: `/es/plans`
- Arabic plans: `/ar/plans`
- French plans: `/fr/plans`

### 6.3 Hreflang

Every localized page emits hreflang links for:

- `en`
- `es`
- `ar`
- `fr`
- `x-default` pointing to the English URL

The root layout emits the same alternates for the homepage, and `localizedMetadata()` emits per-page alternates for the localized routes.

### 6.4 Metadata

- Page titles and descriptions use localized dictionary values where available.
- Open Graph locale is localized (`en_US`, `es_ES`, `ar_AR`, `fr_FR`).
- Canonical and hreflang URLs use the configured site base URL.
- Existing robots/no-index behavior is preserved.

### 6.5 Language selector markup

- Language links use `hrefLang` and `lang` attributes.
- The current locale is marked with `aria-current`.
- The selector uses native `<details>` / `<summary>` elements for keyboard and screen-reader access.
- Links are plain anchors rather than Next.js client links, forcing a full document navigation so `<html lang dir>` updates immediately.

---

## 7. Locale Persistence

- Cookie name: `esimprove_locale`
- Lifetime: one year (`Max-Age=31536000`)
- Path: `/`
- SameSite: `Lax`
- Set by the proxy from locale-prefixed URLs and from localized auth redirects.
- Read on later requests when the URL has no locale prefix.
- `/en/...` resets the cookie to English and redirects to the unprefixed canonical URL.
- Localized login redirects preserve the locale and return path.
- The choice survives refresh, navigation, anonymous browsing, sign-in, and portal use.

---

## 8. Verification

### 8.1 Static checks

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass (Next.js 16.4.6, Turbopack production build) |

### 8.2 Automated tests

| Suite | Result |
| --- | --- |
| `tests/i18n.test.ts` | 15 tests pass |
| Targeted i18n/security/auth/guard suites | 9 files, 69 tests pass |
| Full `npm test` | 65 files, 561 tests pass |

The i18n tests cover:

- Locale registry and native names.
- Arabic-only RTL direction.
- Unknown-locale rejection and English fallback.
- Hreflang descriptors.
- English unprefixed and non-English prefixed URLs.
- Absolute canonical URL generation.
- Locale-prefix splitting and lookalike path handling.
- Dictionary key parity across all four locales.
- No empty translations.
- Interpolation placeholder parity.
- Translator fallback and interpolation behavior.
- Status, support category, and support priority labels.

### 8.3 HTTP verification

A local production server was exercised with a scripted HTTP check covering 70 assertions. All checks passed:

- `/`, `/es`, `/ar`, `/fr` return 200.
- Each locale sets the correct `lang` and `dir`.
- English canonical URLs are unprefixed.
- Non-English canonical URLs are prefixed.
- Hreflang includes all locales and `x-default`.
- Locale cookies are set with the expected attributes.
- `/en` and `/en/plans` return 308 redirects to unprefixed English.
- `/en` redirects are `no-store` and reset the locale cookie.
- Nested localized pages keep the locale and render translated chrome.
- Arabic plan prices are isolated LTR.
- Saved Arabic locale persists on an unprefixed request.
- RTL CSS is shipped and contains the expected Arabic/RTL rules.
- `/de/plans` returns 404 rather than being treated as a locale.
- Anonymous `/ar/portal` redirects to `/ar/login` with the return path and Arabic cookie.
- `/ar/admin` does not fail and remains operational.

### 8.4 Browser and RTL verification

A headless Edge/CDP check exercised desktop and mobile layouts. All 14 checks passed:

- Desktop language menu fits the viewport.
- Menu lists English, Spanish, Arabic, and French.
- Menu links preserve the current page.
- Arabic is marked as the current locale.
- Switching to Spanish navigates to `/es/plans` and updates `<html lang="es" dir="ltr">`.
- Mobile navigation panel fits the viewport.
- Mobile language switcher opens.
- Mobile language menu fits the viewport.
- No horizontal overflow at 390px.
- Mobile navigation keeps Arabic links.
- Mobile navigation is translated.
- English control is LTR after switching back through `/en`.
- English control has no horizontal overflow.

Visual screenshots were reviewed for Arabic desktop/mobile home, Arabic plans, Arabic login, Arabic cart, the Arabic mobile menu, and Spanish/English controls.

### 8.5 Final verification note

Full `npm test` passed: **65 test files, 561 tests** (duration 1,179.19s). The earlier targeted rerun of the affected i18n, security, guard, and auth suites also passed (9 files, 69 tests).

---

## 9. Limitations

1. **Server-generated messages remain English.** Validation messages, auth/contact/checkout action errors, and some notification text originate in server-side validation or actions and are not dictionary-backed yet.
2. **Long-form legal content remains English.** Legal navigation, headings, summaries, and the English-authoritative notice are localized; the full legal body and legal FAQ answers remain English. This is intentional for legal review.
3. **Guide and blog content remain English.** Guide bodies, blog article bodies, and editorial content are not translated in this implementation. Blog articles are explicitly marked `lang="en" dir="ltr"`; guide bodies and legal bodies currently inherit the page direction.
4. **Database-authored catalog and SEO copy remains English.** Admin-authored plan descriptions, destination copy, and SEO settings are not translated automatically.
5. **Admin remains English-only.** This is intentional because admin is an operational surface.
6. **Transactional emails remain English.** Email templates were not localized in this pass.
7. **Sitemap remains English-canonical.** The sitemap continues to list canonical English URLs; localized alternates are emitted in page metadata rather than expanded in the sitemap.
8. **No automatic language negotiation.** The default is English unless the visitor selects a language or has a saved locale cookie. There is no `Accept-Language` auto-selection.
9. **Arabic webfonts are not bundled.** The Arabic font stack relies on system fonts to avoid adding dependencies; appearance varies by device.
10. **Translation review is recommended.** The dictionaries are complete and structurally tested, but a native-speaker review is recommended before launch, particularly for legal-adjacent and support text.
11. **Simple interpolation only.** There is no ICU pluralization library; the implementation uses placeholder interpolation and a simple singular/plural helper.
12. **Client dictionary payload.** The active dictionary is provided to client components through the root provider; route-specific dictionary splitting was not added.

None of these limitations blocks local use of the four-language implementation.

---

## 10. Preservation Confirmation

- English remains the default language.
- Existing unprefixed English URLs remain canonical and unchanged.
- Existing English copy, routes, and behavior were preserved.
- No existing language option or translation was removed.
- Admin routes remain available and English-only.
- No database schema, migration, or seed changes were made.
- No dependency was added or upgraded.
- No credentials, 2FA settings, DNS records, or hosting configuration were changed.
- No Git commit or push was performed.
- Unrelated pre-existing audit and report files in the working tree were not overwritten.

---

## 11. Deployment Confirmation

**No deployment was performed.** This work is a local implementation only. Nothing was published, uploaded, migrated, pushed, or released to any hosting environment. No deployment approval is requested as part of this task.

---

## Appendix A — Main Verification Commands

```text
npm run typecheck
npm run lint
npm run build
npm test
npx vitest run tests/i18n.test.ts tests/wp5-security.test.ts tests/guards-session.test.ts tests/auth-guard.test.ts tests/auth-login-flow.test.ts --reporter=verbose
```

HTTP and browser checks were run against a local production server on port 3100. The temporary server was stopped after verification.

## Appendix B — Local Verification Scripts

- HTTP locale/RTL checks: `%TEMP%\opencode\verify-i18n-http.mjs`
- Browser/CDP interaction checks: `%TEMP%\opencode\verify-rtl-interactions.mjs`

These scripts are local verification aids and are not part of the application source tree.
