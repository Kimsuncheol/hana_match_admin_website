import { describe, expect, it } from "vitest";
import { aggregateModelHealth } from "./aggregate";

const deployment = { modelVersion: "moderation-2026-08-2", rolloutMode: "percentage" as const, rolloutPercentage: 25, rollbackTarget: "moderation-2026-08-1", stateVersion: 4, updatedAt: null };

describe("aggregateModelHealth", () => {
  it("computes language agreement, true median latency, override rate, and failures", () => {
    const result = aggregateModelHealth([
      { language: "ko", agreed: true, overridden: false },
      { language: "ko", agreed: false, overridden: true },
      { language: "ja", agreed: true, overridden: false },
      { language: "mixed", agreed: true, overridden: true },
    ], [
      { latencyMs: 100, success: true },
      { latencyMs: 300, success: false },
      { latencyMs: 500, success: true },
      { latencyMs: 700, success: false },
    ], deployment, new Date("2026-08-30T00:00:00Z"));
    expect(result.agreement).toEqual([
      { language: "ko", agreementPct: 50, agreedReviews: 1, reviewCount: 2 },
      { language: "ja", agreementPct: 100, agreedReviews: 1, reviewCount: 1 },
      { language: "mixed", agreementPct: 100, agreedReviews: 1, reviewCount: 1 },
    ]);
    expect(result.medianLatencyMs).toBe(400);
    expect(result.overrideRatePct).toBe(50);
    expect(result.failures).toBe(2);
  });

  it("returns explicit no-data values instead of invented metrics", () => {
    const result = aggregateModelHealth([], [], deployment, new Date("2026-08-30T00:00:00Z"));
    expect(result.medianLatencyMs).toBeNull();
    expect(result.overrideRatePct).toBeNull();
    expect(result.agreement.every((entry) => entry.agreementPct === null)).toBe(true);
  });
});
