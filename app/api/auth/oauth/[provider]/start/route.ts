import { NextResponse, type NextRequest } from "next/server";
import { appUrl, siteUrl } from "@/lib/config";
import { safeNextPath } from "@/lib/validation";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
  authorizationUrl,
  encodeOAuthState,
  isOAuthProvider,
  newOAuthState,
  oauthConfig,
  oauthRedirectUri,
} from "@/lib/auth/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts Google / Apple sign-in. Linked from the checkout and login pages. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/portal");
  const loginUrl = new URL("/login", siteUrl);
  loginUrl.searchParams.set("next", next);

  if (!isOAuthProvider(provider)) {
    loginUrl.searchParams.set("oauth_error", "unavailable");
    return NextResponse.redirect(loginUrl, 303);
  }
  const config = oauthConfig(provider);
  if (!config) {
    loginUrl.searchParams.set("oauth_error", "unavailable");
    return NextResponse.redirect(loginUrl, 303);
  }

  const state = newOAuthState(provider, next);
  const response = NextResponse.redirect(
    authorizationUrl(config, state, oauthRedirectUri(provider, appUrl)),
    303,
  );
  const secure = appUrl.startsWith("https://");
  response.cookies.set(OAUTH_STATE_COOKIE, encodeOAuthState(state), {
    httpOnly: true,
    secure,
    // Apple returns with a cross-site POST (form_post), which only carries
    // SameSite=None cookies. Google returns with a top-level GET.
    sameSite: provider === "apple" && secure ? "none" : "lax",
    path: "/api/auth/oauth",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
