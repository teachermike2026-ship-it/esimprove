import { describe, expect, it } from "vitest";
import { readBoundedText } from "@/lib/http/bounded-body";

describe("bounded request body", () => {
  it("accepts bodies up to the byte limit", async () => {
    const request = new Request("http://localhost/", { method: "POST", body: "éé" });
    expect(await readBoundedText(request, 4)).toBe("éé");
  });

  it("rejects oversized UTF-8 bodies even without a content-length header", async () => {
    const request = new Request("http://localhost/", { method: "POST", body: "ééé" });
    expect(request.headers.get("content-length")).toBeNull();
    expect(await readBoundedText(request, 5)).toBeNull();
  });

  it("stops reading further chunks after the limit", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.enqueue(new Uint8Array(4));
      },
      cancel() { cancelled = true; },
    });
    const request = { body: stream } as Request;
    expect(await readBoundedText(request, 5)).toBeNull();
    expect(cancelled).toBe(true);
  });
});
