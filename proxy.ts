import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getConfigurationProblems, sessionCookieName } from "@/lib/config";
import { buildContentSecurityPolicy, createSecurityNonce } from "@/lib/security-headers";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_HEADER,
  defaultLocale,
  isLocale,
  splitLocalePath,
} from "@/lib/i18n/config";

let loggedConfigurationFailure = false;

/**
 * Whop Elements may run only in the checkout funnel. The policy covers every
 * /checkout page because the app reaches the payment page by in-app
 * navigation, which keeps the policy of the page the customer started on.
 * Its environment follows WHOP_SANDBOX exactly; anything else keeps it blocked.
 */
function whopElementsFor(unlocalizedPath: string): "sandbox" | "production" | undefined {
  if (unlocalizedPath !== "/checkout" && !unlocalizedPath.startsWith("/checkout/")) return undefined;
  const sandbox = (process.env.WHOP_SANDBOX ?? "").trim().toLowerCase();
  if (sandbox === "true" || sandbox === "1") return "sandbox";
  if (sandbox === "false" || sandbox === "0") return "production";
  return undefined;
}

function contentSecurityPolicy(nonce: string, unlocalizedPath = ""): string {
  return buildContentSecurityPolicy({
    whopElements: whopElementsFor(unlocalizedPath),
    nonce,
    development: process.env.NODE_ENV !== "production",
    upgradeInsecureRequests:
      (process.env.APP_ENV ?? "").trim().toLowerCase() === "production",
  });
}

function withCsp<T extends NextResponse>(response: T, csp: string): T {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function persistedLocaleCookie(value: string): string {
  return `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Emits a fresh nonce for every application request. The nonce is passed both
 * on the request (so Next.js can attach it to framework scripts and server
 * components can read `x-nonce`) and on the response CSP header.
 */
function nextWithNonce(
  request: NextRequest,
  nonce: string,
  csp: string,
  requestHeaders: Headers,
): NextResponse {
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = createSecurityNonce();
  const problems = getConfigurationProblems();

  const { locale: prefixLocale, pathname: unlocalizedPath } = splitLocalePath(pathname);
  const csp = contentSecurityPolicy(nonce, unlocalizedPath);
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const activeLocale = prefixLocale ?? (isLocale(cookieLocale) ? cookieLocale : defaultLocale);

  // Fail closed on a misconfigured deployment before serving application
  // routes. /api/health stays reachable so the owner can see a safe, generic
  // 503 without the proxy exposing configuration details.
  if (problems.length > 0 && unlocalizedPath !== "/api/health") {
    if (!loggedConfigurationFailure) {
      loggedConfigurationFailure = true;
      console.error("Deployment configuration check failed:", problems.join("; "));
    }
    if (unlocalizedPath.startsWith("/api/")) {
      return withCsp(
        NextResponse.json(
          { error: "Service configuration error" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        ),
        csp,
      );
    }
    return withCsp(
      new NextResponse("Service configuration error", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      }),
      csp,
    );
  }

  // Early gate for authenticated areas: missing session cookie → redirect to
  // login with the preserved path/query. The root loading boundary streams the
  // page shell (and then a client-side redirect) before page-level guards run,
  // so without this check anonymous visitors receive a 200 from pages that will
  // ultimately force a client-side login redirect. Deeper role/permission
  // authorization stays with the admin layout, pages, and server actions.
  const gated =
    unlocalizedPath.startsWith("/admin") || unlocalizedPath.startsWith("/portal");
  if (gated) {
    const cookieName = sessionCookieName();
    const sessionCookie = request.cookies.get(cookieName);
    if (!sessionCookie) {
      const loginPath =
        prefixLocale && prefixLocale !== defaultLocale ? `/${prefixLocale}/login` : "/login";
      const redirectUrl = new URL(loginPath, request.url);
      redirectUrl.searchParams.set(
        "next",
        prefixLocale === defaultLocale ? unlocalizedPath + search : pathname + search,
      );
      const response = withCsp(NextResponse.redirect(redirectUrl, 307), csp);
      response.headers.set("Cache-Control", "no-store");
      response.headers.append("Set-Cookie", persistedLocaleCookie(activeLocale));
      return response;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", unlocalizedPath);
  requestHeaders.set(LOCALE_HEADER, activeLocale);

  // `/en/*` is not a canonical URL: redirect it to the unprefixed English path.
  if (prefixLocale === "en" && unlocalizedPath !== pathname) {
    const redirectUrl = new URL(unlocalizedPath + search, request.url);
    const response = withCsp(NextResponse.redirect(redirectUrl, 308), csp);
    response.headers.set("Cache-Control", "no-store");
    response.headers.append("Set-Cookie", persistedLocaleCookie("en"));
    return response;
  }

  // Locale-prefixed URLs are rewritten to the existing unprefixed route files,
  // so no page needs to move. The selected locale is passed to the server tree
  // through a request header and persisted in a cookie for later navigation.
  if (prefixLocale && prefixLocale !== defaultLocale) {
    const rewriteUrl = new URL(unlocalizedPath + search, request.url);
    requestHeaders.set("x-pathname", unlocalizedPath);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = withCsp(
      NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }),
      csp,
    );
    response.headers.append("Set-Cookie", persistedLocaleCookie(prefixLocale));
    return response;
  }

  return nextWithNonce(request, nonce, csp, requestHeaders);
}

export const config = {
  // Run the configuration check, CSP nonce, and admin session gate on
  // application routes, excluding immutable Next.js assets and the public icon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
