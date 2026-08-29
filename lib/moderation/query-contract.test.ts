import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, parseQueueFilters } from "./query-contract";

describe("moderation queue query contract", () => {
  it("accepts only allowlisted filters and normalizes language", () => {
    const result = parseQueueFilters(
      new URL("https://example.com/api?priority=high&language=KO&assignment=mine&targetType=message&slaRisk=at_risk&limit=25"),
    );
    expect(result).toEqual({
      ok: true,
      filters: {
        priority: "high",
        language: "ko",
        assignment: "mine",
        targetType: "message",
        slaRisk: "at_risk",
        limit: 25,
        cursor: undefined,
      },
    });
  });

  it("rejects unknown fields values and oversized pages", () => {
    expect(parseQueueFilters(new URL("https://example.com/api?priority=root")).ok).toBe(false);
    expect(parseQueueFilters(new URL("https://example.com/api?limit=500")).ok).toBe(false);
    expect(parseQueueFilters(new URL("https://example.com/api?language=../../secret")).ok).toBe(false);
    expect(parseQueueFilters(new URL("https://example.com/api?cursor=not-a-cursor")).ok).toBe(false);
  });

  it("round-trips an opaque pagination cursor", () => {
    const cursor = encodeCursor(40);
    expect(decodeCursor(cursor)).toBe(40);
  });
});

