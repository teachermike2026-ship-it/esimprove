import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getConfigurationProblems, sessionCookieName } from "@/lib/config";
import { buildContentSecurityPolicy, createSecurityNonce } from "@/lib/security-headers";

let loggedConfigurationFailure = false;

function contentSecurityPolicy(nonce: string): string {
  return buildContentSecurityPolicy({
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

/**
 * Emits a fresh nonce for every application request. The nonce is passed both
 * on the request (so Next.js can attach it to framework scripts and server
 * components can read `x-nonce`) and on the response CSP header.
 */
function nextWithNonce(request: NextRequest, nonce: string, csp: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js parses the nonce from this request header and applies it to its
  // inline bootstrap, hydration, and flight scripts.
  requestHeaders.set("Content-Security-Policy", csp);
  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = createSecurityNonce();
  const csp = contentSecurityPolicy(nonce);
  const problems = getConfigurationProblems();

  // Fail closed on a misconfigured deployment before serving application
  // routes. /api/health stays reachable so the owner can see a safe, generic
  // 503 without the proxy exposing configuration details.
  if (problems.length > 0 && pathname !== "/api/health") {
    if (!loggedConfigurationFailure) {
      loggedConfigurationFailure = true;
      console.error("Deployment configuration check failed:", problems.join("; "));
    }
    if (pathname.startsWith("/api/")) {
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

  // Early admin gate: missing session cookie → redirect to login with the
  // preserved path/query. Deeper role/permission authorization is enforced by
  // the admin layout, pages, and server actions.
  if (!pathname.startsWith("/admin")) {
    return nextWithNonce(request, nonce, csp);
  }

  const cookieName = sessionCookieName();
  const sessionCookie = request.cookies.get(cookieName);
  if (!sessionCookie) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname + search);
    return withCsp(NextResponse.redirect(redirectUrl, 307), csp);
  }

  return nextWithNonce(request, nonce, csp);
}

export const config = {
  // Run the configuration check, CSP nonce, and admin session gate on
  // application routes, excluding immutable Next.js assets and the public icon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
