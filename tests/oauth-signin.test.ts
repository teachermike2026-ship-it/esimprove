/**
 * Google / Apple sign-in, tested against FAKE provider endpoints and locally
 * generated signing keys. Nothing here reaches Google or Apple.
 */
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { userConsents, userIdentities, users } from "@/lib/db/schema";
import {
  OAUTH_ONLY_PASSWORD_HASH,
  OAuthError,
  appleClientSecret,
  appleNameFromForm,
  authorizationUrl,
  clearJwksCache,
  decodeOAuthState,
  encodeOAuthState,
  exchangeCodeForIdToken,
  newOAuthState,
  oauthAvailability,
  oauthConfig,
  resolveOAuthAccount,
  verifyIdToken,
  type AppleConfig,
  type GoogleConfig,
} from "@/lib/auth/oauth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { makeTestDb } from "./helpers/db";

const google: GoogleConfig = { provider: "google", clientId: "client-123.apps.googleusercontent.com", clientSecret: "secret" };

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...rsa.publicKey.export({ format: "jwk" }), kid: "test-key-1", alg: "RS256", use: "sig" };
const otherRsa = generateKeyPairSync("rsa", { modulusLength: 2048 });

function idToken(claims: Record<string, unknown>, key = rsa.privateKey, kid = "test-key-1"): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), key).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const now = Math.floor(Date.now() / 1000);
function googleClaims(extra: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: google.clientId,
    sub: "google-sub-1",
    email: "Traveler.One@Gmail.com",
    email_verified: true,
    name: "Traveler One",
    nonce: "nonce-1",
    iat: now,
    exp: now + 600,
    ...extra,
  };
}

const requests: Array<{ url: string; body?: string }> = [];
function fakeFetch(token: string) {
  return (async (url: string, init?: RequestInit) => {
    requests.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
    if (url.includes("/certs") || url.endsWith("/auth/keys")) {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    }
    return new Response(JSON.stringify({ id_token: token }), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("OAuth configuration and request building", () => {
  it("enables a provider only when all of its credentials are set", () => {
    expect(oauthAvailability({})).toEqual({ google: false, apple: false });
    expect(oauthAvailability({ GOOGLE_CLIENT_ID: "x" }).google).toBe(false);
    expect(oauthAvailability({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "y" }).google).toBe(true);
    expect(oauthAvailability({ APPLE_CLIENT_ID: "a", APPLE_TEAM_ID: "b", APPLE_KEY_ID: "c" }).apple).toBe(false);
  });

  it("builds a Google URL with state, nonce and PKCE, and an Apple form_post URL", () => {
    const state = newOAuthState("google", "/checkout");
    const url = new URL(authorizationUrl(google, state, "https://esimprove.com/api/auth/oauth/google/callback"));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("state")).toBe(state.state);
    expect(url.searchParams.get("nonce")).toBe(state.nonce);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).not.toBe(state.codeVerifier);
    expect(url.searchParams.get("scope")).toBe("openid email profile");

    const apple = oauthConfig("apple", {
      APPLE_CLIENT_ID: "com.esimprove.web",
      APPLE_TEAM_ID: "TEAM123456",
      APPLE_KEY_ID: "KEY1234567",
      APPLE_PRIVATE_KEY: "pem",
    })!;
    const appleUrl = new URL(authorizationUrl(apple, newOAuthState("apple", "/checkout"), "https://esimprove.com/cb"));
    expect(appleUrl.origin).toBe("https://appleid.apple.com");
    expect(appleUrl.searchParams.get("response_mode")).toBe("form_post");
  });

  it("round-trips the per-attempt state and rejects tampering", () => {
    const state = newOAuthState("google", "/checkout");
    expect(decodeOAuthState(encodeOAuthState(state))).toEqual(state);
    expect(decodeOAuthState("garbage")).toBeNull();
    expect(decodeOAuthState(Buffer.from(JSON.stringify({ ...state, provider: "evil" })).toString("base64url"))).toBeNull();
  });

  it("signs the Apple client secret as an ES256 JWT that Apple can verify", () => {
    const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const config: AppleConfig = {
      provider: "apple",
      clientId: "com.esimprove.web",
      teamId: "TEAM123456",
      keyId: "KEY1234567",
      privateKey: ec.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    };
    const jwt = appleClientSecret(config);
    const [h, p, s] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toMatchObject({
      iss: "TEAM123456",
      sub: "com.esimprove.web",
      aud: "https://appleid.apple.com",
    });
    const ok = verify("sha256", Buffer.from(`${h}.${p}`), { key: ec.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });

  it("reads Apple's one-time name field safely", () => {
    expect(appleNameFromForm(JSON.stringify({ name: { firstName: "Ada", lastName: "L" } }))).toBe("Ada L");
    expect(appleNameFromForm("{bad")).toBeNull();
    expect(appleNameFromForm(null)).toBeNull();
  });
});

describe("ID token verification", () => {
  beforeEach(() => clearJwksCache());

  it("exchanges the code with PKCE and accepts a valid Google token", async () => {
    const token = idToken(googleClaims());
    const fetchImpl = fakeFetch(token);
    requests.length = 0;
    const received = await exchangeCodeForIdToken(google, { code: "code-1", codeVerifier: "verifier-1", redirectUri: "https://x/cb" }, fetchImpl);
    expect(requests[0]!.body).toContain("code_verifier=verifier-1");
    const identity = await verifyIdToken(google, received, "nonce-1", { fetchImpl });
    expect(identity).toEqual({ subject: "google-sub-1", email: "traveler.one@gmail.com", emailVerified: true, name: "Traveler One" });
  });

  it.each([
    ["wrong nonce", googleClaims({ nonce: "other" })],
    ["wrong audience", googleClaims({ aud: "someone-else" })],
    ["wrong issuer", googleClaims({ iss: "https://evil.example" })],
    ["expired", googleClaims({ exp: now - 3600 })],
  ])("rejects a token with %s", async (_label, claims) => {
    await expect(verifyIdToken(google, idToken(claims), "nonce-1", { fetchImpl: fakeFetch("") })).rejects.toBeInstanceOf(OAuthError);
  });

  it("rejects a token signed by another key", async () => {
    const forged = idToken(googleClaims(), otherRsa.privateKey);
    await expect(verifyIdToken(google, forged, "nonce-1", { fetchImpl: fakeFetch("") })).rejects.toThrow(/signature/);
  });
});

describe("account resolution (no duplicate accounts)", () => {
  let handle: DatabaseHandle;
  beforeAll(async () => {
    handle = await makeTestDb();
  }, 180_000);
  afterAll(async () => handle.close());

  const identity = { subject: "google-sub-new", email: "new.traveler@gmail.com", emailVerified: true, name: "New Traveler" };

  it("registers a new customer with verified email, consents and no usable password", async () => {
    const result = await resolveOAuthAccount(handle.db, "google", identity);
    expect(result).toMatchObject({ created: true, linked: false });
    const user = (await handle.db.select().from(users).where(eq(users.id, result.userId)))[0]!;
    expect(user).toMatchObject({ email: "new.traveler@gmail.com", name: "New Traveler", role: "customer" });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBe(OAUTH_ONLY_PASSWORD_HASH);
    expect(await verifyPassword("anything at all", user.passwordHash)).toBe(false);
    const consents = await handle.db.select().from(userConsents).where(eq(userConsents.userId, result.userId));
    expect(consents.map((row) => row.purpose).sort()).toEqual(expect.arrayContaining(["age", "privacy", "terms"]));
  });

  it("signs the same identity in again without creating another account", async () => {
    const first = await resolveOAuthAccount(handle.db, "google", identity);
    const second = await resolveOAuthAccount(handle.db, "google", { ...identity, name: "Renamed" });
    expect(second.userId).toBe(first.userId);
    expect(second.created).toBe(false);
    const rows = await handle.db.select().from(users).where(eq(users.email, identity.email));
    expect(rows).toHaveLength(1);
  });

  it("links Apple to the existing account with the same verified email", async () => {
    const google = await resolveOAuthAccount(handle.db, "google", identity);
    const apple = await resolveOAuthAccount(handle.db, "apple", { ...identity, subject: "apple-sub-1" });
    expect(apple).toMatchObject({ userId: google.userId, linked: true, created: false });
    const links = await handle.db.select().from(userIdentities).where(eq(userIdentities.userId, google.userId));
    expect(links.map((row) => row.provider).sort()).toEqual(["apple", "google"]);
  });

  it("links to an existing email + password customer, who can still log in with the password", async () => {
    const userId = crypto.randomUUID();
    await handle.db.insert(users).values({
      id: userId,
      email: "password.customer@example.com",
      name: "Password Customer",
      passwordHash: await hashPassword("CorrectHorse!42"),
      role: "customer",
    });
    const result = await resolveOAuthAccount(handle.db, "google", {
      subject: "google-sub-pw",
      email: "password.customer@example.com",
      emailVerified: true,
      name: null,
    });
    expect(result).toMatchObject({ userId, linked: true });
    const user = (await handle.db.select().from(users).where(eq(users.id, userId)))[0]!;
    expect(await verifyPassword("CorrectHorse!42", user.passwordHash)).toBe(true);
  });

  it("refuses unverified emails and admin accounts", async () => {
    await expect(
      resolveOAuthAccount(handle.db, "google", { subject: "unverified", email: "u@example.com", emailVerified: false, name: null }),
    ).rejects.toMatchObject({ code: "email_unverified" });
    const admin = (await handle.db.select().from(users).where(eq(users.role, "admin")).limit(1))[0]!;
    await expect(
      resolveOAuthAccount(handle.db, "google", { subject: "admin-sub", email: admin.email, emailVerified: true, name: null }),
    ).rejects.toMatchObject({ code: "admin" });
    expect(await handle.db.select().from(userIdentities).where(eq(userIdentities.subject, "admin-sub"))).toHaveLength(0);
  });
});
