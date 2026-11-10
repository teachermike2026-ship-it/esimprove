import { describe, expect, it } from "vitest";
import {
  UNIDENTIFIED_CLIENT,
  clientIpHash,
  resolveClientAddress,
} from "@/lib/request-ip";

describe("trusted client address resolution", () => {
  it("prefers Netlify's observed address in deployed contexts", () => {
    const headers = new Headers({
      "x-nf-client-connection-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.99, 10.0.0.1",
      "x-real-ip": "192.0.2.50",
    });
    expect(resolveClientAddress(headers, { deployed: true })).toBe("203.0.113.10");
  });

  it("ignores client-controlled forwarding headers when deployed", () => {
    expect(
      resolveClientAddress(
        new Headers({
          "x-forwarded-for": "203.0.113.20",
          "x-real-ip": "203.0.113.21",
        }),
        { deployed: true },
      ),
    ).toBeNull();
  });

  it("accepts forwarded addresses only outside a deployed context", () => {
    expect(
      resolveClientAddress(new Headers({ "x-forwarded-for": "203.0.113.30, 10.0.0.2" }), {
        deployed: false,
      }),
    ).toBe("203.0.113.30");
    expect(
      resolveClientAddress(new Headers({ "x-real-ip": "203.0.113.31" }), { deployed: false }),
    ).toBe("203.0.113.31");
  });

  it("normalizes ports, brackets, and IPv6 zone identifiers", () => {
    expect(
      resolveClientAddress(new Headers({ "x-nf-client-connection-ip": "203.0.113.40:443" }), {
        deployed: true,
      }),
    ).toBe("203.0.113.40");
    expect(
      resolveClientAddress(
        new Headers({ "x-nf-client-connection-ip": "[2001:db8::1]:443" }),
        { deployed: true },
      ),
    ).toBe("2001:db8::1");
    expect(
      resolveClientAddress(
        new Headers({ "x-nf-client-connection-ip": "2001:db8::2%eth0" }),
        { deployed: true },
      ),
    ).toBe("2001:db8::2");
  });

  it("rejects malformed and non-IP values", () => {
    for (const value of ["not-an-ip", "999.1.1.1", "http://203.0.113.50", "203.0.113"]) {
      expect(
        resolveClientAddress(new Headers({ "x-nf-client-connection-ip": value }), {
          deployed: true,
        }),
      ).toBeNull();
    }
  });

  it("hashes identities without exposing the raw address", () => {
    const first = clientIpHash(
      new Headers({ "x-nf-client-connection-ip": "203.0.113.60" }),
      { deployed: true },
    );
    const same = clientIpHash(
      new Headers({ "x-nf-client-connection-ip": "203.0.113.60" }),
      { deployed: true },
    );
    const other = clientIpHash(
      new Headers({ "x-nf-client-connection-ip": "203.0.113.61" }),
      { deployed: true },
    );
    const missing = clientIpHash(new Headers(), { deployed: true });
    const malformed = clientIpHash(
      new Headers({ "x-nf-client-connection-ip": "garbage" }),
      { deployed: true },
    );

    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(first).not.toContain("203.0.113.60");
    expect(missing).toBe(malformed);
    expect(clientIpHash(new Headers(), { deployed: true })).toBe(
      clientIpHash(new Headers({ "x-forwarded-for": "203.0.113.62" }), { deployed: true }),
    );
    expect(UNIDENTIFIED_CLIENT).toBe("unidentified-client");
  });
});
