import { describe, expect, it } from "vitest";
import { parseUserOperationsFilters } from "./query-contract";

describe("user operations query contract", () => {
  it("accepts exact email or UID searches with allowlisted filters", () => {
    const result = parseUserOperationsFilters(new URL("https://example.com/api?q=user@example.com&verification=verified&status=active&restriction=clear&trust=trusted&limit=25"));
    expect(result).toEqual({ ok: true, filters: { query: "user@example.com", verification: "verified", status: "active", restriction: "clear", trust: "trusted", limit: 25, cursor: undefined } });
  });
  it("rejects fuzzy, malformed, and oversized queries", () => {
    expect(parseUserOperationsFilters(new URL("https://example.com/api?q=*example*" )).ok).toBe(false);
    expect(parseUserOperationsFilters(new URL("https://example.com/api?status=suspended" )).ok).toBe(false);
    expect(parseUserOperationsFilters(new URL("https://example.com/api?limit=500" )).ok).toBe(false);
  });
});

