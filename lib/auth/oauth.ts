/**
 * Google and Apple sign-in (OpenID Connect, authorization-code flow).
 *
 * Security model:
 * - state (CSRF), nonce (ID-token replay) and, for Google, PKCE are generated
 *   per attempt and kept in a short-lived HTTP-only cookie.
 * - The ID token's RS256 signature is verified against the provider's
 *   published keys (JWKS), together with issuer, audience, expiry and nonce.
 * - An account is found by the provider's stable subject id first. A new
 *   identity is linked to an existing account only when the provider says the
 *   email is verified, so one person never ends up with two accounts.
 * - Admin accounts cannot sign in this way: they keep password + TOTP.
 *
 * Nothing here is enabled unless the provider's credentials are configured.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  timingSafeEqual,
  verify as cryptoVerify,
  type JsonWebKey,
} from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { userIdentities, users } from "@/lib/db/schema";
import { randomToken } from "@/lib/crypto";
import { newId } from "@/lib/ids";
import { isAdminRole } from "@/lib/auth/roles";
import { recordConsent } from "@/lib/consents";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal-profile";
import { getOrCreateUserPreferences, updateUserPreferences } from "@/lib/user-preferences";
import { recordAudit } from "@/lib/audit";

export const OAUTH_PROVIDERS = ["google", "apple"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** Password hash placeholder for accounts created through Google/Apple. */
export const OAUTH_ONLY_PASSWORD_HASH = "oauth$no-password";

export const OAUTH_STATE_COOKIE = "esimprove_oauth";
const STATE_TTL_SECONDS = 10 * 60;

type Env = Record<string, string | undefined>;

interface ProviderEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  issuers: string[];
}

const ENDPOINTS: Record<OAuthProvider, ProviderEndpoints> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
  },
  apple: {
    authorizeUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
  },
};

export interface GoogleConfig {
  provider: "google";
  clientId: string;
  clientSecret: string;
}

export interface AppleConfig {
  provider: "apple";
  /** The Services ID used for web sign-in. */
  clientId: string;
  teamId: string;
  keyId: string;
  /** PKCS#8 PEM of the Sign in with Apple key (\n may be escaped). */
  privateKey: string;
}

export type OAuthConfig = GoogleConfig | AppleConfig;

function read(env: Env, name: string): string | null {
  return env[name]?.trim() || null;
}

export function oauthConfig(provider: OAuthProvider, env: Env = process.env): OAuthConfig | null {
  if (provider === "google") {
    const clientId = read(env, "GOOGLE_CLIENT_ID");
    const clientSecret = read(env, "GOOGLE_CLIENT_SECRET");
    return clientId && clientSecret ? { provider, clientId, clientSecret } : null;
  }
  const clientId = read(env, "APPLE_CLIENT_ID");
  const teamId = read(env, "APPLE_TEAM_ID");
  const keyId = read(env, "APPLE_KEY_ID");
  const privateKey = read(env, "APPLE_PRIVATE_KEY")?.replace(/\\n/g, "\n") ?? null;
  return clientId && teamId && keyId && privateKey
    ? { provider, clientId, teamId, keyId, privateKey }
    : null;
}

export function oauthAvailability(env: Env = process.env): Record<OAuthProvider, boolean> {
  return { google: oauthConfig("google", env) !== null, apple: oauthConfig("apple", env) !== null };
}

export function oauthRedirectUri(provider: OAuthProvider, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/auth/oauth/${provider}/callback`;
}

// ---------------------------------------------------------------------------
// Per-attempt state

export interface OAuthState {
  provider: OAuthProvider;
  state: string;
  nonce: string;
  codeVerifier: string;
  next: string;
  expiresAt: number;
}

export function newOAuthState(provider: OAuthProvider, next: string, now = Date.now()): OAuthState {
  return {
    provider,
    state: randomToken(32),
    nonce: randomToken(32),
    codeVerifier: randomToken(48),
    next,
    expiresAt: now + STATE_TTL_SECONDS * 1000,
  };
}

export function encodeOAuthState(value: OAuthState): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeOAuthState(raw: string | undefined | null): OAuthState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OAuthState>;
    if (
      typeof value.provider !== "string" ||
      !isOAuthProvider(value.provider) ||
      typeof value.state !== "string" ||
      typeof value.nonce !== "string" ||
      typeof value.codeVerifier !== "string" ||
      typeof value.next !== "string" ||
      typeof value.expiresAt !== "number"
    ) {
      return null;
    }
    return value as OAuthState;
  } catch {
    return null;
  }
}

export const OAUTH_STATE_MAX_AGE = STATE_TTL_SECONDS;

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authorizationUrl(config: OAuthConfig, state: OAuthState, redirectUri: string): string {
  const url = new URL(ENDPOINTS[config.provider].authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state.state);
  url.searchParams.set("nonce", state.nonce);
  if (config.provider === "google") {
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("code_challenge", pkceChallenge(state.codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
  } else {
    // Apple returns the name only with form_post, and only on first consent.
    url.searchParams.set("scope", "name email");
    url.searchParams.set("response_mode", "form_post");
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Apple client secret (ES256 JWT, valid for 5 minutes)

export function appleClientSecret(config: AppleConfig, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = { alg: "ES256", kid: config.keyId, typ: "JWT" };
  const payload = { iss: config.teamId, iat, exp: iat + 300, aud: "https://appleid.apple.com", sub: config.clientId };
  const encoded = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(
    JSON.stringify(payload),
  ).toString("base64url")}`;
  const signature = cryptoSign("sha256", Buffer.from(encoded), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${encoded}.${signature.toString("base64url")}`;
}

// ---------------------------------------------------------------------------
// Token exchange and ID-token verification

export class OAuthError extends Error {
  constructor(
    readonly code: "failed" | "email_unverified" | "admin" | "conflict" | "invalid_token",
    message: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function exchangeCodeForIdToken(
  config: OAuthConfig,
  input: { code: string; codeVerifier: string; redirectUri: string },
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: config.clientId,
    redirect_uri: input.redirectUri,
    client_secret: config.provider === "google" ? config.clientSecret : appleClientSecret(config),
  });
  if (config.provider === "google") body.set("code_verifier", input.codeVerifier);
  const response = await fetchImpl(ENDPOINTS[config.provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Never echo the provider's body: it can contain the code or tokens.
    throw new OAuthError("failed", `The ${config.provider} token exchange failed (HTTP ${response.status}).`);
  }
  const json = (await response.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string") {
    throw new OAuthError("failed", `The ${config.provider} token response had no ID token.`);
  }
  return json.id_token;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const JWKS_TTL_MS = 60 * 60 * 1000;

async function loadJwks(provider: OAuthProvider, fetchImpl: FetchLike, refresh = false): Promise<Jwk[]> {
  const url = ENDPOINTS[provider].jwksUrl;
  const cached = jwksCache.get(url);
  if (!refresh && cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new OAuthError("failed", `Could not load ${provider} signing keys.`);
  const json = (await response.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(json.keys) ? json.keys : [];
  jwksCache.set(url, { keys, fetchedAt: Date.now() });
  return keys;
}

/** Test hook: forget cached provider keys. */
export function clearJwksCache(): void {
  jwksCache.clear();
}

export interface VerifiedIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export async function verifyIdToken(
  config: OAuthConfig,
  idToken: string,
  expectedNonce: string,
  options: { fetchImpl?: FetchLike; now?: number } = {},
): Promise<VerifiedIdentity> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new OAuthError("invalid_token", "Malformed ID token.");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new OAuthError("invalid_token", "Malformed ID token.");
  }
  if (header.alg !== "RS256" || !header.kid) {
    throw new OAuthError("invalid_token", "Unexpected ID token algorithm.");
  }

  let jwk = (await loadJwks(config.provider, fetchImpl)).find((key) => key.kid === header.kid);
  if (!jwk) jwk = (await loadJwks(config.provider, fetchImpl, true)).find((key) => key.kid === header.kid);
  if (!jwk) throw new OAuthError("invalid_token", "Unknown ID token signing key.");

  const valid = cryptoVerify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signatureB64, "base64url"),
  );
  if (!valid) throw new OAuthError("invalid_token", "ID token signature is invalid.");

  const issuers = ENDPOINTS[config.provider].issuers;
  if (typeof claims.iss !== "string" || !issuers.includes(claims.iss)) {
    throw new OAuthError("invalid_token", "ID token issuer mismatch.");
  }
  const audience = claims.aud;
  const audienceOk = Array.isArray(audience) ? audience.includes(config.clientId) : audience === config.clientId;
  if (!audienceOk) throw new OAuthError("invalid_token", "ID token audience mismatch.");
  if (typeof claims.exp !== "number" || claims.exp < now - 60) {
    throw new OAuthError("invalid_token", "ID token has expired.");
  }
  if (typeof claims.iat === "number" && claims.iat > now + 300) {
    throw new OAuthError("invalid_token", "ID token was issued in the future.");
  }
  if (typeof claims.nonce !== "string" || !safeEqual(claims.nonce, expectedNonce)) {
    throw new OAuthError("invalid_token", "ID token nonce mismatch.");
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 255) {
    throw new OAuthError("invalid_token", "ID token has no subject.");
  }
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null;
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  const name = typeof claims.name === "string" ? claims.name.trim().slice(0, 80) : null;
  return { subject: claims.sub, email, emailVerified, name };
}

/** Apple sends the user's name once, as JSON in the `user` form field. */
export function appleNameFromForm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } };
    const parts = [value.name?.firstName, value.name?.lastName].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0,
    );
    return parts.length > 0 ? parts.join(" ").trim().slice(0, 80) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Account resolution

export interface ResolvedAccount {
  userId: string;
  created: boolean;
  linked: boolean;
}

function fallbackName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^A-Za-z0-9._-]/g, " ").trim();
  return (cleaned.length >= 2 ? cleaned : "Traveler").slice(0, 80);
}

function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 4; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === "23505") return true;
    if (typeof candidate.message === "string" && /duplicate key|unique constraint/i.test(candidate.message)) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

/**
 * Signs in an existing account, links a verified identity to the account with
 * the same verified email, or creates one new customer account. Never creates
 * a second account for the same provider identity or the same email.
 */
export async function resolveOAuthAccount(
  db: Database,
  provider: OAuthProvider,
  identity: VerifiedIdentity,
  context: { ipHash?: string | null; userAgent?: string | null } = {},
): Promise<ResolvedAccount> {
  const found = await db
    .select({ identityId: userIdentities.id, userId: users.id, role: users.role })
    .from(userIdentities)
    .innerJoin(users, eq(users.id, userIdentities.userId))
    .where(and(eq(userIdentities.provider, provider), eq(userIdentities.subject, identity.subject)))
    .limit(1);
  const known = found[0];
  if (known) {
    if (isAdminRole(known.role)) {
      throw new OAuthError("admin", "Admin accounts sign in with a password and an authenticator code.");
    }
    await db
      .update(userIdentities)
      .set({ lastLoginAt: new Date(), ...(identity.emailVerified && identity.email ? { email: identity.email } : {}) })
      .where(eq(userIdentities.id, known.identityId));
    return { userId: known.userId, created: false, linked: false };
  }

  if (!identity.email || !identity.emailVerified) {
    throw new OAuthError(
      "email_unverified",
      "Your account did not share a verified email address, so we could not sign you in.",
    );
  }
  const email = identity.email;

  const existingUser = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existingUser) {
    if (isAdminRole(existingUser.role)) {
      throw new OAuthError("admin", "Admin accounts sign in with a password and an authenticator code.");
    }
    const sameProvider = await db
      .select({ id: userIdentities.id })
      .from(userIdentities)
      .where(and(eq(userIdentities.userId, existingUser.id), eq(userIdentities.provider, provider)))
      .limit(1);
    if (sameProvider.length > 0) {
      throw new OAuthError(
        "conflict",
        "This email is already linked to a different account with this provider. Sign in with that account.",
      );
    }
    try {
      await db.insert(userIdentities).values({
        id: newId("identity"),
        userId: existingUser.id,
        provider,
        subject: identity.subject,
        email,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return resolveOAuthAccount(db, provider, identity, context);
    }
    // The provider has verified this address.
    if (!existingUser.emailVerifiedAt) {
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, existingUser.id));
    }
    await recordAudit(db, {
      actorType: "user",
      actorId: existingUser.id,
      action: "auth.oauth_linked",
      entityType: "user",
      entityId: existingUser.id,
      metadata: { provider },
    });
    return { userId: existingUser.id, created: false, linked: true };
  }

  const userId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email,
        name: identity.name || fallbackName(email),
        passwordHash: OAUTH_ONLY_PASSWORD_HASH,
        role: "customer",
        emailVerifiedAt: new Date(),
      });
      await tx.insert(userIdentities).values({
        id: newId("identity"),
        userId,
        provider,
        subject: identity.subject,
        email,
      });
    });
  } catch (error) {
    // A parallel callback for the same person won the race: use that account.
    if (isUniqueViolation(error)) return resolveOAuthAccount(db, provider, identity, context);
    throw error;
  }

  // The sign-in buttons state that continuing accepts the Terms of Service and
  // the Privacy Policy and confirms legal age; record that like registration.
  const consentContext = {
    ipHash: context.ipHash ?? null,
    userAgent: context.userAgent ?? null,
    surface: `oauth_${provider}`,
  };
  for (const purpose of ["terms", "privacy", "age"] as const) {
    await recordConsent(db, { userId, purpose, version: LEGAL_DOCUMENT_VERSION, accepted: true, ...consentContext });
  }
  await getOrCreateUserPreferences(db, userId);
  await updateUserPreferences(db, userId, {
    marketingOptIn: false,
    productUpdatesOptIn: false,
    orderUpdatesOptIn: true,
  });
  await recordAudit(db, {
    actorType: "user",
    actorId: userId,
    action: "auth.oauth_register",
    entityType: "user",
    entityId: userId,
    metadata: { provider },
  });
  return { userId, created: true, linked: false };
}
