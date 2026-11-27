import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { appUrl, siteUrl } from "@/lib/config";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, requestIpHash } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import {
  OAUTH_STATE_COOKIE,
  OAuthError,
  appleNameFromForm,
  decodeOAuthState,
  exchangeCodeForIdToken,
  isOAuthProvider,
  oauthConfig,
  oauthRedirectUri,
  resolveOAuthAccount,
  safeEqual,
  verifyIdToken,
} from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FORM_BYTES = 16 * 1024;

function redirectTo(path: string, clearState = true): NextResponse {
  const response = NextResponse.redirect(new URL(path, siteUrl), 303);
  response.headers.set("Cache-Control", "no-store");
  if (clearState) {
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/auth/oauth", maxAge: 0 });
  }
  return response;
}

function loginError(next: string, code: string): NextResponse {
  const query = new URLSearchParams({ next, oauth_error: code });
  return redirectTo(`/login?${query.toString()}`);
}

async function readParams(request: NextRequest): Promise<URLSearchParams> {
  if (request.method === "POST") {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_FORM_BYTES) return new URLSearchParams();
    const text = (await request.text()).slice(0, MAX_FORM_BYTES);
    return new URLSearchParams(text);
  }
  return request.nextUrl.searchParams;
}

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;
  const state = decodeOAuthState(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const next = safeNextPath(state?.next, "/portal");
  if (!isOAuthProvider(provider)) return loginError(next, "failed");
  const config = oauthConfig(provider);
  if (!config) return loginError(next, "unavailable");

  const query = await readParams(request);
  if (query.get("error")) return loginError(next, "cancelled");
  const returnedState = query.get("state") ?? "";
  const code = query.get("code") ?? "";
  if (
    !state ||
    state.provider !== provider ||
    state.expiresAt < Date.now() ||
    !returnedState ||
    !safeEqual(returnedState, state.state) ||
    !code ||
    code.length > 2048
  ) {
    return loginError(next, "expired");
  }

  const db = await getDb();
  const ipHash = requestIpHash(request.headers);
  const rate = await checkRateLimit(db, `oauth:ip:${ipHash}`, 30, 15 * 60);
  if (!rate.allowed) return loginError(next, "rate_limited");

  try {
    const idToken = await exchangeCodeForIdToken(config, {
      code,
      codeVerifier: state.codeVerifier,
      redirectUri: oauthRedirectUri(provider, appUrl),
    });
    const identity = await verifyIdToken(config, idToken, state.nonce);
    if (provider === "apple" && !identity.name) {
      identity.name = appleNameFromForm(query.get("user"));
    }
    const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;
    const account = await resolveOAuthAccount(db, provider, identity, { ipHash, userAgent });
    const session = await createSession(db, account.userId, {
      ttlMinutes: Number(process.env.SESSION_TTL_DAYS || "30") * 24 * 60,
      ipHash,
      userAgent,
    });
    await setSessionCookie(session.token, session.expiresAt);
    await recordAudit(db, {
      actorType: "user",
      actorId: account.userId,
      action: "auth.oauth_login",
      entityType: "user",
      entityId: account.userId,
      metadata: { provider, created: account.created, linked: account.linked },
    });
    return redirectTo(next);
  } catch (error) {
    if (error instanceof OAuthError) {
      console.warn(`oauth ${provider} sign-in refused: ${error.code}`);
      return loginError(next, error.code === "invalid_token" ? "failed" : error.code);
    }
    console.error(`oauth ${provider} sign-in failed`, error instanceof Error ? error.name : "error");
    return loginError(next, "failed");
  }
}

export const GET = handle;
export const POST = handle;
