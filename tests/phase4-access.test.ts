import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  analyticsVisitors,
  blogArticles,
  blogCategories,
  blogTags,
  users,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { createSession } from "@/lib/auth/session";
import { loadSeoSettings } from "@/lib/seo";
import { makeTestDb } from "./helpers/db";

const mockState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name.endsWith("_session") && mockState.token
        ? { name, value: mockState.token }
        : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

type RedirectError = { digest?: string; message?: string };

async function expectRedirect(action: () => Promise<unknown>, fragment: string) {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeTruthy();
  const value = caught as RedirectError;
  const text = `${value.digest ?? ""} ${value.message ?? ""} ${String(caught)}`;
  expect(text.toLowerCase()).toContain(fragment.toLowerCase());
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function trackingRequest(options: {
  body: unknown;
  headers?: Record<string, string>;
  method?: string;
}): NextRequest {
  const headers = new Headers({
    "content-type": "application/json",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ...(options.headers ?? {}),
  });
  return new NextRequest("http://localhost:3000/api/track", {
    method: options.method ?? "POST",
    headers,
    body:
      options.method === "GET" ? undefined : JSON.stringify(options.body),
  });
}

function validTrackingPayload(visitor: string, session: string) {
  return {
    visitorId: visitor,
    sessionId: session,
    events: [{ type: "page_view", path: "/about", title: "About" }],
  };
}

describe("Phase 4 admin access and public tracking endpoint", () => {
  let handle: DatabaseHandle;
  let adminUserId: string;
  let customerUserId: string;

  beforeAll(async () => {
    handle = await makeTestDb();
    const [admin] = await handle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "admin@demo.local"))
      .limit(1);
    adminUserId = admin!.id;

    customerUserId = newId("user");
    await handle.db.insert(users).values({
      id: customerUserId,
      email: "phase4-customer@example.test",
      name: "Phase 4 Customer",
      passwordHash: "unused",
      role: "customer",
    });

    (
      globalThis as typeof globalThis & {
        __esimproveDbPromise?: Promise<DatabaseHandle>;
      }
    ).__esimproveDbPromise = Promise.resolve(handle);
  });

  afterAll(async () => {
    const globalWithDb = globalThis as typeof globalThis & {
      __esimproveDbPromise?: Promise<DatabaseHandle>;
    };
    globalWithDb.__esimproveDbPromise = undefined;
    await handle.close();
  });

  describe("admin guards", () => {
    it("redirects unauthenticated visitors to login", async () => {
      mockState.token = null;
      const { requireAdmin } = await import("@/lib/auth/guards");
      await expectRedirect(
        () => requireAdmin("/admin/analytics"),
        "/login?next=%2Fadmin%2Fanalytics",
      );
    });

    it("redirects customers away from admin pages", async () => {
      mockState.token = (
        await createSession(handle.db, customerUserId, { ttlMinutes: 60 })
      ).token;
      const { requireAdmin } = await import("@/lib/auth/guards");
      await expectRedirect(() => requireAdmin("/admin/seo"), "/portal");
    });

    it("redirects sessions that have not completed two-factor authentication", async () => {
      mockState.token = (
        await createSession(handle.db, adminUserId, {
          ttlMinutes: 60,
          pendingTwoFactor: true,
        })
      ).token;
      const { requireAdmin } = await import("@/lib/auth/guards");
      await expectRedirect(() => requireAdmin("/admin/blog"), "/login/2fa");
    });

    it("accepts an administrator session", async () => {
      mockState.token = (
        await createSession(handle.db, adminUserId, { ttlMinutes: 60 })
      ).token;
      const { requireAdmin } = await import("@/lib/auth/guards");
      const user = await requireAdmin("/admin/analytics");
      expect(user.id).toBe(adminUserId);
      expect(user.role).toBe("admin");
    });
  });

  describe("admin action authorization", () => {
    it("rejects unauthenticated SEO, CMS, and blog mutations", async () => {
      mockState.token = null;
      const seo = await import("@/app/admin/seo/actions");
      const blog = await import("@/app/admin/blog/actions");

      await expectRedirect(
        () => seo.saveSeoSettingsAction({}, form({ siteName: "x" })),
        "/login",
      );
      await expectRedirect(
        () =>
          blog.saveArticleAction(
            {},
            form({ title: "x", bodyHtml: "<p>x</p>" }),
          ),
        "/login",
      );
      await expectRedirect(
        () => blog.deleteArticleAction(form({ id: "art_x" })),
        "/login",
      );
      await expectRedirect(
        () => blog.setArticleStatusAction(form({ id: "art_x", status: "published" })),
        "/login",
      );
      await expectRedirect(
        () => blog.saveCategoryAction(form({ name: "Category" })),
        "/login",
      );
      await expectRedirect(
        () => blog.deleteCategoryAction(form({ id: "cat_x" })),
        "/login",
      );
      await expectRedirect(
        () => blog.saveTagAction(form({ name: "Tag" })),
        "/login",
      );
      await expectRedirect(
        () => blog.deleteTagAction(form({ id: "tag_x" })),
        "/login",
      );
    });

    it("rejects customer callers before touching the database", async () => {
      mockState.token = (
        await createSession(handle.db, customerUserId, { ttlMinutes: 60 })
      ).token;
      const seo = await import("@/app/admin/seo/actions");
      const blog = await import("@/app/admin/blog/actions");

      await expectRedirect(
        () => seo.saveSeoSettingsAction({}, form({ siteName: "x" })),
        "/portal",
      );
      await expectRedirect(
        () =>
          blog.saveArticleAction(
            {},
            form({ title: "x", bodyHtml: "<p>x</p>" }),
          ),
        "/portal",
      );
      expect(await loadSeoSettings(handle.db)).toBeTruthy();
    });
  });

  describe("administrator mutations", () => {
    beforeAll(() => {
      mockState.token = null;
    });

    it("saves SEO settings only through an administrator session", async () => {
      mockState.token = (
        await createSession(handle.db, adminUserId, { ttlMinutes: 60 })
      ).token;
      const { saveSeoSettingsAction } = await import("@/app/admin/seo/actions");
      const before = await loadSeoSettings(handle.db);
      const result = await saveSeoSettingsAction(
        {},
        form({
          siteName: "Access Test Site",
          homepageTitle: "Access test homepage",
          homepageDescription: "Access test description.",
          titleTemplate: "{title} | {site_name}",
          canonicalBase: "https://access.example",
          defaultOgImage: "https://access.example/og.png",
          defaultOgTitle: "Access test",
          defaultOgDescription: "Access test social description.",
          logoUrl: "https://access.example/logo.png",
          faviconUrl: "https://access.example/favicon.ico",
          organizationName: "Access Test Ltd",
          organizationUrl: "https://access.example",
          organizationSameAs: "https://x.com/access\nhttps://linkedin.com/company/access",
          robotsDefault: "index, follow",
          indexDefault: "on",
          gscVerificationToken: "access-verification",
          gscProperty: "https://access.example",
          ga4MeasurementId: "G-ACCESS123456",
        }),
      );
      expect(result.ok).toBe(true);
      const after = await loadSeoSettings(handle.db);
      expect(after.siteName).toBe("Access Test Site");
      expect(after.canonicalBase).toBe("https://access.example");
      expect(after.organizationSameAs).toHaveLength(2);
      expect(after.gscVerificationToken).toBe("access-verification");
      expect(before.siteName).not.toBe(after.siteName);
    });

    it("creates categories, tags, and articles through admin actions", async () => {
      mockState.token = (
        await createSession(handle.db, adminUserId, { ttlMinutes: 60 })
      ).token;
      const { saveArticleAction, saveCategoryAction, saveTagAction } =
        await import("@/app/admin/blog/actions");

      await saveCategoryAction(
        form({ name: "Access Category", slug: "access-category" }),
      );
      await saveTagAction(form({ name: "Access Tag", slug: "access-tag" }));
      const [category] = await handle.db
        .select()
        .from(blogCategories)
        .where(eq(blogCategories.slug, "access-category"));
      const [tag] = await handle.db
        .select()
        .from(blogTags)
        .where(eq(blogTags.slug, "access-tag"));
      expect(category).toBeTruthy();
      expect(tag).toBeTruthy();

      const created = await saveArticleAction(
        {},
        form({
          title: "Access controlled article",
          slug: "access-controlled-article",
          bodyHtml: "<p>Authorized content</p>",
          status: "draft",
          categoryId: category!.id,
          tagIds: "",
        }),
      );
      expect(created.ok).toBe(true);
      const [article] = await handle.db
        .select()
        .from(blogArticles)
        .where(eq(blogArticles.id, created.id!));
      expect(article!.authorId).toBe(adminUserId);
      expect(article!.categoryId).toBe(category!.id);
    });
  });

  describe("public analytics endpoint", () => {
    it("rejects non-POST methods", async () => {
      const { GET } = await import("@/app/api/track/route");
      const response = GET();
      expect(response.status).toBe(405);
    });

    it("rejects cross-origin submissions", async () => {
      const { POST } = await import("@/app/api/track/route");
      const response = await POST(
        trackingRequest({
          body: validTrackingPayload("visitor_cross00", "session_cross00"),
          headers: { origin: "https://evil.example" },
        }),
      );
      expect(response.status).toBe(403);
    });

    it("honours Do Not Track and Global Privacy Control without storing data", async () => {
      const { POST } = await import("@/app/api/track/route");
      const before = await handle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(analyticsVisitors);

      const dnt = await POST(
        trackingRequest({
          body: validTrackingPayload("visitor_dnt0000", "session_dnt0000"),
          headers: { dnt: "1" },
        }),
      );
      expect(dnt.status).toBe(204);

      const gpc = await POST(
        trackingRequest({
          body: validTrackingPayload("visitor_gpc0000", "session_gpc0000"),
          headers: { "sec-gpc": "1" },
        }),
      );
      expect(gpc.status).toBe(204);

      const after = await handle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(analyticsVisitors);
      expect(Number(after[0]!.count)).toBe(Number(before[0]!.count));
    });

    it("rejects invalid JSON and invalid payloads", async () => {
      const { POST } = await import("@/app/api/track/route");
      const headers = new Headers({ "content-type": "application/json" });
      const malformed = await POST(
        new NextRequest("http://localhost:3000/api/track", {
          method: "POST",
          headers,
          body: "{not-json",
        }),
      );
      expect(malformed.status).toBe(400);

      const invalid = await POST(
        trackingRequest({
          body: {
            visitorId: "short",
            sessionId: "short",
            events: [{ type: "page_view", path: "/" }],
          },
        }),
      );
      expect(invalid.status).toBe(400);
    });

    it("accepts valid events and marks internal traffic as excluded", async () => {
      const { POST } = await import("@/app/api/track/route");

      const publicResponse = await POST(
        trackingRequest({
          body: validTrackingPayload("visitor_public00", "session_public00"),
          headers: { "x-country": "PT" },
        }),
      );
      expect(publicResponse.status).toBe(202);
      const publicBody = (await publicResponse.json()) as {
        ok: boolean;
        accepted: number;
        excluded: boolean;
      };
      expect(publicBody).toEqual({ ok: true, accepted: 1, excluded: false });

      const internalResponse = await POST(
        trackingRequest({
          body: validTrackingPayload("visitor_internal0", "session_internal0"),
          headers: { "x-esimprove-internal": "1" },
        }),
      );
      expect(internalResponse.status).toBe(202);
      const internalBody = (await internalResponse.json()) as {
        ok: boolean;
        excluded: boolean;
      };
      expect(internalBody.excluded).toBe(true);
    });
  });
});
