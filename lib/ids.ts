import { randomBytes, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function generateOrderNumber(): string {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear().toString().slice(-2),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  const suffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `ES-${stamp}-${suffix}`;
}
