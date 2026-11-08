import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SITEMAP_STATIC_PATHS } from "@/lib/sitemap";

const APP_DIR = join(process.cwd(), "app");

function routeFile(path: string): string {
  const normalized = path.replace(/^\/+/, "");
  return normalized ? join(APP_DIR, normalized, "page.tsx") : join(APP_DIR, "page.tsx");
}

function walkPages(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkPages(full));
    } else if (entry.name === "page.tsx") {
      files.push(full);
    }
  }
  return files;
}

function routeFromFile(file: string): string {
  const rel = relative(APP_DIR, file).replace(/\\/g, "/");
  return `/${rel.replace(/\/?page\.tsx$/, "")}`.replace(/\/$/, "") || "/";
}

const NOINDEX_PATTERN = /robots:\s*\{[^}]*index:\s*false/;

describe("sitemap static routes", () => {
  it("maps every static sitemap path to an existing page route", () => {
    for (const path of SITEMAP_STATIC_PATHS) {
      const file = routeFile(path);
      expect(statSync(file).isFile(), `${path} should resolve to ${file}`).toBe(true);
    }
  });

  it("does not advertise routes that do not exist", () => {
    expect(SITEMAP_STATIC_PATHS).not.toContain("/compatibility/install");
    expect(() => statSync(routeFile("/compatibility/install"))).toThrow();
  });

  it("includes public legal and privacy routes", () => {
    for (const path of ["/legal/faq", "/legal/accessibility", "/privacy/request"]) {
      expect(SITEMAP_STATIC_PATHS).toContain(path);
    }
  });

  it("never lists a page that sets robots index: false", () => {
    const noindexRoutes = walkPages(APP_DIR)
      .filter((file) => NOINDEX_PATTERN.test(readFileSync(file, "utf8")))
      .map(routeFromFile);

    expect(noindexRoutes).toEqual(
      expect.arrayContaining(["/cart", "/checkout", "/login", "/portal", "/register"]),
    );
    for (const route of noindexRoutes) {
      expect(SITEMAP_STATIC_PATHS).not.toContain(route);
    }
  });
});
