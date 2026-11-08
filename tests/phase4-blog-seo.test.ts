import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  blogArticles,
  blogArticleTags,
  blogCategories,
  blogTags,
  seoSettings,
  users,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { createSession } from "@/lib/auth/session";
import { makeTestDb } from "./helpers/db";
import {
  auditSeoHealth,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildPageMeta,
  buildSiteJsonLd,
  getSeoSettings,
  loadSeoSettings,
  saveSeoSettings,
  titleTemplateForNext,
} from "@/lib/seo";
import {
  htmlToText,
  isValidSlug,
  normalizeSlug,
  sanitizeBlogHtml,
} from "@/lib/sanitize";
import {
  getBlogArticleAdmin,
  getPublishedArticleBySlug,
  listBlogArticlesAdmin,
  listPublishedArticles,
} from "@/lib/blog";
import { buildSitemap } from "@/lib/sitemap";
import { buildRobotsPolicy, ROBOTS_DISALLOW } from "@/lib/robots";
import { publishDueScheduledArticles } from "@/lib/blog-schedule";

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

async function adminId(handle: DatabaseHandle): Promise<string> {
  const [admin] = await handle.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@demo.local"))
    .limit(1);
  expect(admin).toBeTruthy();
  return admin!.id;
}

async function insertArticle(
  handle: DatabaseHandle,
  values: {
    slug: string;
    title: string;
    status?: string;
    publishedAt?: Date | null;
    scheduledAt?: Date | null;
    categoryId?: string | null;
    excerpt?: string;
    bodyHtml?: string;
    seoTitle?: string;
    seoDescription?: string;
    canonicalUrl?: string;
    featuredImage?: string;
    featuredAlt?: string;
  },
): Promise<string> {
  const authorId = await adminId(handle);
  const id = newId("art");
  await handle.db.insert(blogArticles).values({
    id,
    slug: values.slug,
    title: values.title,
    excerpt: values.excerpt ?? "",
    bodyHtml: values.bodyHtml ?? "<p>Body</p>",
    bodyText: htmlToText(values.bodyHtml ?? "<p>Body</p>"),
    status: values.status ?? "draft",
    publishedAt: values.publishedAt ?? null,
    scheduledAt: values.scheduledAt ?? null,
    authorId,
    categoryId: values.categoryId ?? null,
    featuredImage: values.featuredImage ?? "",
    featuredAlt: values.featuredAlt ?? "",
    seoTitle: values.seoTitle ?? "",
    seoDescription: values.seoDescription ?? "",
    canonicalUrl: values.canonicalUrl ?? "",
    robots: "index, follow",
  });
  return id;
}

function articleForm(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

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

describe("Phase 4 blog and SEO", () => {
  let handle: DatabaseHandle;
  let adminUserId: string;

  beforeAll(async () => {
    handle = await makeTestDb();
    adminUserId = await adminId(handle);
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

  describe("slug validation and HTML sanitization", () => {
    it("normalizes slugs and rejects malformed values", () => {
      expect(normalizeSlug("  Hello, World! Édition 2026  ")).toBe(
        "hello-world-edition-2026",
      );
      expect(normalizeSlug("--Already--Slugged--")).toBe("already-slugged");
      expect(normalizeSlug("日本")).toBe("");
      expect(isValidSlug("hello-world")).toBe(true);
      expect(isValidSlug("a")).toBe(true);
      expect(isValidSlug("Hello-World")).toBe(false);
      expect(isValidSlug("-leading")).toBe(false);
      expect(isValidSlug("trailing-")).toBe(false);
      expect(isValidSlug("under_score")).toBe(false);
      expect(isValidSlug("a".repeat(100))).toBe(true);
      expect(isValidSlug("a".repeat(101))).toBe(false);
    });

    it("strips scripts, event handlers, and unsafe URLs", () => {
      const dirty = [
        "<script>alert('xss')</script>",
        "<style>body{display:none}</style>",
        "<iframe src=\"https://evil.example\"></iframe>",
        "<p onclick=\"alert(1)\">Hello <strong>world</strong></p>",
        "<a href=\"javascript:alert(1)\">bad link</a>",
        "<a href=\"https://example.com\" target=\"_blank\">good link</a>",
        "<img src=\"https://example.com/image.png\" onerror=\"alert(1)\" alt=\"A cat\">",
        "<img src=\"data:text/html;base64,AAAA\" alt=\"bad\">",
        "<!-- secret comment -->",
      ].join("");

      const clean = sanitizeBlogHtml(dirty);
      expect(clean).not.toMatch(/<script/i);
      expect(clean).not.toMatch(/alert\('xss'\)/);
      expect(clean).not.toMatch(/<style/i);
      expect(clean).not.toMatch(/<iframe/i);
      expect(clean).not.toMatch(/onerror/i);
      expect(clean).not.toMatch(/onclick/i);
      expect(clean).not.toMatch(/javascript:/i);
      expect(clean).not.toMatch(/data:text\/html/i);
      expect(clean).not.toMatch(/<!--/);
      expect(clean).toContain("<p>Hello <strong>world</strong></p>");
      expect(clean).toContain('href="https://example.com"');
      expect(clean).toContain('rel="noopener noreferrer"');
      expect(clean).toContain('src="https://example.com/image.png"');
      expect(clean).toContain('alt="A cat"');
    });

    it("converts sanitized HTML to plain text", () => {
      expect(htmlToText("<p>Hello &amp; <strong>welcome</strong></p>")).toBe(
        "Hello & welcome",
      );
    });
  });

  describe("SEO settings and metadata", () => {
    it("round-trips global SEO settings through the database", async () => {
      const defaults = await getSeoSettings(handle.db);
      expect(defaults.siteName).toBeTruthy();

      await saveSeoSettings(handle.db, {
        ...defaults,
        siteName: "Esimprove Test",
        homepageTitle: "Travel data, simplified",
        homepageDescription: "Compare eSIM plans for every destination.",
        titleTemplate: "{title} | {site_name}",
        canonicalBase: "https://esimprove.example",
        defaultOgImage: "https://esimprove.example/og.png",
        organizationName: "Esimprove Test Ltd",
        organizationUrl: "https://esimprove.example",
        organizationSameAs: ["https://x.com/esimprove"],
        gscVerificationToken: "test-verification-token",
        ga4MeasurementId: "G-TEST123456",
      });

      const loaded = await loadSeoSettings(handle.db);
      expect(loaded.siteName).toBe("Esimprove Test");
      expect(loaded.canonicalBase).toBe("https://esimprove.example");
      expect(loaded.organizationSameAs).toEqual(["https://x.com/esimprove"]);
      expect(loaded.gscVerificationToken).toBe("test-verification-token");
      expect(loaded.ga4MeasurementId).toBe("G-TEST123456");

      const rows = await handle.db.select().from(seoSettings);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe("seo_global");
    });

    it("builds absolute page metadata and JSON-LD from settings", async () => {
      const settings = await loadSeoSettings(handle.db);
      const meta = buildPageMeta(settings, {
        title: "Japan eSIM plans",
        description: "Data plans for Japan.",
        canonical: "/destinations/japan",
        ogImage: "https://esimprove.example/japan.png",
      });

      expect(meta.title).toBe("Japan eSIM plans");
      expect(meta.canonical).toBe("https://esimprove.example/destinations/japan");
      expect(meta.og.image).toBe("https://esimprove.example/japan.png");
      expect(meta.robots).toBe("index, follow");

      const jsonLd = JSON.parse(meta.jsonLd) as {
        "@context": string;
        "@graph": { "@type": string; name?: string; url?: string }[];
      };
      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@graph"].some((node) => node["@type"] === "WebPage")).toBe(
        true,
      );
      expect(jsonLd["@graph"].some((node) => node["@type"] === "Organization")).toBe(
        true,
      );
    });

    it("builds article and breadcrumb JSON-LD", async () => {
      const settings = await loadSeoSettings(handle.db);
      const article = JSON.parse(
        buildArticleJsonLd(settings, {
          title: "How to stay online in Japan",
          description: "A practical guide.",
          url: "https://esimprove.example/blog/japan-online",
          image: "https://esimprove.example/japan.png",
          publishedAt: new Date("2026-01-02T03:04:05Z"),
          updatedAt: new Date("2026-02-03T04:05:06Z"),
          authorName: "Demo Administrator",
        }),
      ) as Record<string, unknown>;
      expect(article["@type"]).toBe("Article");
      expect(article.headline).toBe("How to stay online in Japan");
      expect(article.datePublished).toBe("2026-01-02T03:04:05.000Z");
      expect(article.dateModified).toBe("2026-02-03T04:05:06.000Z");
      expect(article.author).toEqual({
        "@type": "Person",
        name: "Demo Administrator",
      });

      const breadcrumb = JSON.parse(
        buildBreadcrumbJsonLd([
          { name: "Home", url: "https://esimprove.example" },
          { name: "Blog", url: "https://esimprove.example/blog" },
        ]),
      ) as { itemListElement: { position: number; name: string }[] };
      expect(breadcrumb.itemListElement).toHaveLength(2);
      expect(breadcrumb.itemListElement[1]!.position).toBe(2);
      expect(breadcrumb.itemListElement[1]!.name).toBe("Blog");
    });

    it("builds site-level JSON-LD and a Next.js title template", async () => {
      const settings = await loadSeoSettings(handle.db);
      const site = JSON.parse(buildSiteJsonLd(settings)) as {
        "@graph": { "@type": string }[];
      };
      expect(site["@graph"].map((node) => node["@type"])).toContain("WebSite");
      expect(site["@graph"].map((node) => node["@type"])).toContain(
        "Organization",
      );
      expect(titleTemplateForNext(settings)).toBe("%s | Esimprove Test");
    });
  });

  describe("blog data layer", () => {
    it("publishes only due, published articles publicly", async () => {
      const categoryId = newId("cat");
      await handle.db.insert(blogCategories).values({
        id: categoryId,
        slug: "connectivity",
        name: "Connectivity",
        description: "Staying online abroad.",
      });

      const publishedId = await insertArticle(handle, {
        slug: "published-article",
        title: "Published article",
        status: "published",
        publishedAt: new Date(Date.now() - 60_000),
        categoryId,
        excerpt: "This is public.",
      });
      await insertArticle(handle, {
        slug: "draft-article",
        title: "Draft article",
        status: "draft",
      });
      await insertArticle(handle, {
        slug: "scheduled-article",
        title: "Scheduled article",
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 86_400_000),
      });
      await insertArticle(handle, {
        slug: "future-published-article",
        title: "Future published article",
        status: "published",
        publishedAt: new Date(Date.now() + 86_400_000),
      });

      const publicList = await listPublishedArticles(handle.db);
      const slugs = publicList.articles.map((article) => article.slug);
      expect(slugs).toContain("published-article");
      expect(slugs).not.toContain("draft-article");
      expect(slugs).not.toContain("scheduled-article");
      expect(slugs).not.toContain("future-published-article");

      const publicArticle = await getPublishedArticleBySlug(
        handle.db,
        "published-article",
      );
      expect(publicArticle?.id).toBe(publishedId);
      expect(publicArticle?.categoryName).toBe("Connectivity");
      expect(await getPublishedArticleBySlug(handle.db, "draft-article")).toBeNull();

      const adminList = await listBlogArticlesAdmin(handle.db, {
        status: "draft",
      });
      expect(adminList.articles.map((article) => article.slug)).toEqual([
        "draft-article",
      ]);

      const adminArticle = await getBlogArticleAdmin(handle.db, publishedId);
      expect(adminArticle?.slug).toBe("published-article");
    });

    it("attaches tags and supports category and tag pages", async () => {
      const tagId = newId("tag");
      await handle.db.insert(blogTags).values({
        id: tagId,
        slug: "japan",
        name: "Japan",
      });
      const [article] = await handle.db
        .select({ id: blogArticles.id })
        .from(blogArticles)
        .where(eq(blogArticles.slug, "published-article"));
      await handle.db.insert(blogArticleTags).values({
        articleId: article!.id,
        tagId,
      });

      const byTag = await listPublishedArticles(handle.db, { tagSlug: "japan" });
      expect(byTag.articles.map((entry) => entry.slug)).toEqual([
        "published-article",
      ]);
      expect(byTag.articles[0]!.tags).toEqual([
        { id: tagId, slug: "japan", name: "Japan" },
      ]);

      const byCategory = await listPublishedArticles(handle.db, {
        categorySlug: "connectivity",
      });
      expect(byCategory.articles.map((entry) => entry.slug)).toEqual([
        "published-article",
      ]);
    });

    it("enforces unique slugs at the database level", async () => {
      await expect(
        insertArticle(handle, {
          slug: "published-article",
          title: "Duplicate slug",
        }),
      ).rejects.toThrow();
    });
  });

  describe("scheduled publishing", () => {
    it("promotes only due scheduled articles and is idempotent", async () => {
      const dueId = await insertArticle(handle, {
        slug: "due-scheduled",
        title: "Due scheduled",
        status: "scheduled",
        scheduledAt: new Date(Date.now() - 120_000),
      });
      const laterId = await insertArticle(handle, {
        slug: "later-scheduled",
        title: "Later scheduled",
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 3_600_000),
      });

      const first = await publishDueScheduledArticles(handle.db);
      expect(first.published).toBe(1);
      expect(first.slugs).toEqual(["due-scheduled"]);

      const second = await publishDueScheduledArticles(handle.db);
      expect(second.published).toBe(0);

      const [due] = await handle.db
        .select()
        .from(blogArticles)
        .where(eq(blogArticles.id, dueId));
      const [later] = await handle.db
        .select()
        .from(blogArticles)
        .where(eq(blogArticles.id, laterId));
      expect(due!.status).toBe("published");
      expect(due!.publishedAt).toBeTruthy();
      expect(due!.scheduledAt).toBeNull();
      expect(later!.status).toBe("scheduled");
    });
  });

  describe("admin article actions", () => {
    it("rejects unauthenticated callers", async () => {
      mockState.token = null;
      const { saveArticleAction, deleteArticleAction } = await import(
        "@/app/admin/blog/actions"
      );
      await expectRedirect(
        () => saveArticleAction({}, articleForm({ title: "x", bodyHtml: "<p>x</p>" })),
        "/login",
      );
      await expectRedirect(
        () => deleteArticleAction(articleForm({ id: "art_x" })),
        "/login",
      );
    });

    it("sanitizes content and enforces the duplicate-slug rule", async () => {
      const session = await createSession(handle.db, adminUserId, {
        ttlMinutes: 60,
      });
      mockState.token = session.token;
      const { saveArticleAction } = await import("@/app/admin/blog/actions");

      const form = articleForm({
        title: "Action created article",
        slug: "action-created-article",
        excerpt: "Created through the action.",
        bodyHtml:
          "<p onclick=\"bad()\">Safe</p><script>alert(1)</script><a href=\"javascript:bad()\">bad</a>",
        status: "draft",
      });
      const created = await saveArticleAction({}, form);
      expect(created.ok).toBe(true);
      expect(created.id).toBeTruthy();

      const [row] = await handle.db
        .select()
        .from(blogArticles)
        .where(eq(blogArticles.id, created.id!));
      expect(row!.bodyHtml).not.toMatch(/script|onclick|javascript:/i);
      expect(row!.bodyHtml).toContain("<p>Safe</p>");
      expect(row!.bodyText).toContain("Safe");

      const duplicate = await saveArticleAction(
        {},
        articleForm({
          title: "Duplicate",
          slug: "action-created-article",
          bodyHtml: "<p>Duplicate</p>",
          status: "draft",
        }),
      );
      expect(duplicate.ok).toBeUndefined();
      expect(duplicate.error).toContain("already in use");
    });

    it("requires a future date for scheduled articles", async () => {
      mockState.token = (
        await createSession(handle.db, adminUserId, { ttlMinutes: 60 })
      ).token;
      const { saveArticleAction } = await import("@/app/admin/blog/actions");

      const past = await saveArticleAction(
        {},
        articleForm({
          title: "Past scheduled",
          slug: "past-scheduled",
          bodyHtml: "<p>Body</p>",
          status: "scheduled",
          scheduledAt: "2020-01-01T00:00",
        }),
      );
      expect(past.ok).toBeUndefined();
      expect(past.error).toContain("future");

      const future = await saveArticleAction(
        {},
        articleForm({
          title: "Future scheduled",
          slug: "future-scheduled",
          bodyHtml: "<p>Body</p>",
          status: "scheduled",
          scheduledAt: "2030-01-01T00:00",
        }),
      );
      expect(future.ok).toBe(true);
      expect(await getPublishedArticleBySlug(handle.db, "future-scheduled")).toBeNull();
    });

    it("requires alt text when a featured image is used", async () => {
      mockState.token = (
        await createSession(handle.db, adminUserId, { ttlMinutes: 60 })
      ).token;
      const { saveArticleAction } = await import("@/app/admin/blog/actions");
      const result = await saveArticleAction(
        {},
        articleForm({
          title: "Image without alt",
          slug: "image-without-alt",
          bodyHtml: "<p>Body</p>",
          featuredImage: "https://example.com/image.png",
          status: "draft",
        }),
      );
      expect(result.ok).toBeUndefined();
      expect(result.error).toContain("Alt text");
    });

    it("publishes and unpublishes through the status action", async () => {
      mockState.token = (
        await createSession(handle.db, adminUserId, { ttlMinutes: 60 })
      ).token;
      const { saveArticleAction, setArticleStatusAction } = await import(
        "@/app/admin/blog/actions"
      );
      const created = await saveArticleAction(
        {},
        articleForm({
          title: "Status toggled",
          slug: "status-toggled",
          bodyHtml: "<p>Body</p>",
          status: "draft",
        }),
      );
      expect(created.ok).toBe(true);

      await setArticleStatusAction(
        articleForm({ id: created.id!, status: "published" }),
      );
      expect(
        (await getPublishedArticleBySlug(handle.db, "status-toggled"))?.title,
      ).toBe("Status toggled");

      await setArticleStatusAction(
        articleForm({ id: created.id!, status: "draft" }),
      );
      expect(
        await getPublishedArticleBySlug(handle.db, "status-toggled"),
      ).toBeNull();
    });
  });

  describe("sitemap and robots", () => {
    it("includes published blog URLs and excludes drafts and scheduled posts", async () => {
      const tagId = newId("tag");
      await handle.db.insert(blogTags).values({
        id: tagId,
        slug: "sitemap-tag",
        name: "Sitemap tag",
      });
      const [published] = await handle.db
        .select({ id: blogArticles.id })
        .from(blogArticles)
        .where(eq(blogArticles.slug, "published-article"));
      await handle.db.insert(blogArticleTags).values({
        articleId: published!.id,
        tagId,
      });

      const entries = await buildSitemap(handle.db);
      const urls = entries.map((entry) => entry.url);

      expect(urls).toContain("https://esimprove.example/blog/published-article");
      expect(urls).toContain("https://esimprove.example/blog/due-scheduled");
      expect(urls).not.toContain(
        "https://esimprove.example/blog/action-created-article",
      );
      expect(urls).toContain("https://esimprove.example/blog");
      expect(urls).toContain("https://esimprove.example/blog/category/connectivity");
      expect(urls).toContain("https://esimprove.example/blog/tag/sitemap-tag");
      expect(urls).not.toContain("https://esimprove.example/blog/draft-article");
      expect(urls).not.toContain("https://esimprove.example/blog/scheduled-article");
      expect(urls).not.toContain(
        "https://esimprove.example/blog/future-published-article",
      );
      expect(urls).not.toContain("https://esimprove.example/blog/future-scheduled");
      expect(urls).toContain("https://esimprove.example/about");
      expect(urls.every((url) => url.startsWith("https://esimprove.example"))).toBe(
        true,
      );
    });

    it("disallows every crawler in demo/noindex mode", () => {
      const policy = buildRobotsPolicy({
        noIndex: true,
        baseUrl: "https://esimprove.example",
      });
      expect(policy.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
      expect(policy.sitemap).toBeUndefined();
    });

    it("allows public pages and blocks private routes in production mode", () => {
      const policy = buildRobotsPolicy({
        noIndex: false,
        baseUrl: "https://esimprove.example/",
      });
      const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
      const main = rules[0] as { allow?: string; disallow?: string[] };
      expect(main.allow).toBe("/");
      expect(main.disallow).toEqual(ROBOTS_DISALLOW);
      expect(main.disallow).toEqual(
        expect.arrayContaining(["/admin", "/api", "/checkout", "/portal"]),
      );
      expect(policy.sitemap).toBe("https://esimprove.example/sitemap.xml");
      expect(policy.host).toBe("https://esimprove.example");
    });
  });

  describe("SEO health audit", () => {
    it("reports missing and duplicate metadata for published articles only", async () => {
      const healthHandle = await makeTestDb();
      try {
        await insertArticle(healthHandle, {
          slug: "complete",
          title: "Complete article",
          status: "published",
          publishedAt: new Date(Date.now() - 60_000),
          excerpt: "Complete description",
          seoTitle: "Complete article",
          seoDescription: "Complete description",
          canonicalUrl: "https://esimprove.example/blog/complete",
          featuredImage: "https://esimprove.example/complete.png",
          featuredAlt: "Complete image",
        });
        await insertArticle(healthHandle, {
          slug: "missing-meta",
          title: "Duplicate title",
          status: "published",
          publishedAt: new Date(Date.now() - 60_000),
          excerpt: "",
          seoTitle: "Duplicate title",
          seoDescription: "",
          featuredImage: "https://esimprove.example/missing.png",
          featuredAlt: "",
        });
        await insertArticle(healthHandle, {
          slug: "duplicate-meta",
          title: "Duplicate title",
          status: "published",
          publishedAt: new Date(Date.now() - 60_000),
          excerpt: "",
          seoTitle: "Duplicate title",
          seoDescription: "",
        });
        await insertArticle(healthHandle, {
          slug: "health-draft",
          title: "Draft without metadata",
          status: "draft",
        });
        await insertArticle(healthHandle, {
          slug: "health-scheduled",
          title: "Scheduled without metadata",
          status: "scheduled",
          scheduledAt: new Date(Date.now() + 60_000),
        });

        const health = await auditSeoHealth(healthHandle.db);
        expect(health.totalPages).toBe(5);
        expect(health.publishedCount).toBe(3);
        expect(health.draftCount).toBe(1);
        expect(health.scheduledCount).toBe(1);
        expect(health.missingTitle).toBe(0);
        expect(health.missingDescription).toBe(2);
        expect(health.duplicateTitles).toBe(1);
        expect(health.missingCanonical).toBe(2);
        expect(health.missingFeaturedImage).toBe(1);
        expect(health.missingAlt).toBe(1);
        expect(health.warnings.map((warning) => warning.type)).toEqual(
          expect.arrayContaining([
            "Missing descriptions",
            "Duplicate titles",
            "Missing image alt text",
            "Missing canonical URLs",
          ]),
        );
      } finally {
        await healthHandle.close();
      }
    });
  });
});
