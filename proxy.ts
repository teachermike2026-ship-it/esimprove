import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getConfigurationProblems, sessionCookieName } from "@/lib/config";

let loggedConfigurationFailure = false;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new NextResponse("Service configuration error", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  // Only protect admin paths; don't loop on login itself.
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return NextResponse.next();
  }

  const cookieName = sessionCookieName();
  const sessionCookie = request.cookies.get(cookieName);

  // Early gate: missing session cookie → redirect to login with preserved path/query.
  if (!sessionCookie) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(redirectUrl, 307);
  }

  // Cookie present: allow to proceed; deeper authorization (requireAdmin) is
  // enforced by the admin layout and pages.
  return NextResponse.next();
}

export const config = {
  // Run the configuration check and admin session gate on application routes,
  // excluding immutable Next.js assets and the public icon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
