import { describe, expect, it } from "vitest";
import {
  validateConnectionUrl,
  validateConnectionUrlWithDns,
} from "@/lib/adapters/ssrf-guard";

describe("supplier URL SSRF validation", () => {
  it("allows ordinary public HTTPS URLs and normalizes them", () => {
    const result = validateConnectionUrl("https://api.supplier.example.com/v1");
    expect(result.safe).toBe(true);
    expect(result.url).toBe("https://api.supplier.example.com/v1");
    expect(validateConnectionUrl("https://supplier.example.com:8443").safe).toBe(true);
  });

  it.each([
    "http://localhost:3000",
    "http://localhost./api",
    "http://foo.localhost",
    "http://service.local",
    "http://metadata.google.internal",
    "http://169.254.169.254/latest/meta-data",
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.1.1",
    "http://100.64.0.1",
    "http://0.0.0.0",
    "http://[::1]",
    "http://[::]",
    "http://[::ffff:127.0.0.1]",
    "http://[fd00::1]",
    "http://[fe80::1]",
    "http://[ff02::1]",
    "http://[2001:db8::1]",
    "http://[2002:7f00:1::]",
    "http://2130706433",
    "http://0x7f000001",
    "https://user:pass@example.com/path",
    "https://example.com:8080",
    "ftp://example.com",
    "javascript:alert(1)",
    "not a url",
  ])("blocks unsafe destination %s", (url) => {
    expect(validateConnectionUrl(url).safe).toBe(false);
  });

  it("rejects DNS answers that resolve to internal addresses", async () => {
    const blocked = await validateConnectionUrlWithDns("https://supplier.example.com", {
      resolver: async () => ["93.184.216.34", "10.0.0.7"],
    });
    expect(blocked.safe).toBe(false);
    expect(blocked.error).toMatch(/Private\/internal/);

    const allowed = await validateConnectionUrlWithDns("https://supplier.example.com", {
      resolver: async () => ["93.184.216.34"],
    });
    expect(allowed.safe).toBe(true);
  });

  it("fails closed when DNS resolution fails", async () => {
    const result = await validateConnectionUrlWithDns("https://supplier.example.com", {
      resolver: async () => {
        throw new Error("NXDOMAIN");
      },
    });
    expect(result.safe).toBe(false);
    expect(result.error).toMatch(/could not be resolved/);
  });
});
