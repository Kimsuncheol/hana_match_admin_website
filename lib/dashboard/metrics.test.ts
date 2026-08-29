import { describe, expect, it } from "vitest";
import {
  buildPriorityQueue,
  computeCaseMetrics,
  computeModelHealth,
  computeOverallLatencyP95,
  slaStateFor,
} from "./metrics";
import type { CaseRecord, LatencyLog } from "./types";

const NOW = new Date("2026-08-29T12:00:00Z");

function makeCase(overrides: Partial<CaseRecord>): CaseRecord {
  return {
    id: "case-1",
    status: "open",
    priority: "medium",
    category: "message",
    openedAt: new Date("2026-08-29T00:00:00Z"),
    slaDueAt: new Date("2026-08-30T00:00:00Z"),
    contentHidden: false,
    summary: "reported for harassment",
    ...overrides,
  };
}

describe("slaStateFor", () => {
  it("is ok when far from the deadline", () => {
    expect(slaStateFor(makeCase({ slaDueAt: new Date("2026-08-30T00:00:00Z") }), NOW)).toBe("ok");
  });

  it("is at_risk within the risk window but not yet due", () => {
    expect(slaStateFor(makeCase({ slaDueAt: new Date("2026-08-29T13:00:00Z") }), NOW)).toBe("at_risk");
  });

  it("is breached once past the deadline", () => {
    expect(slaStateFor(makeCase({ slaDueAt: new Date("2026-08-29T11:00:00Z") }), NOW)).toBe("breached");
  });

  it("is ok for a resolved case even if the deadline has passed", () => {
    const c = makeCase({
      slaDueAt: new Date("2026-08-29T11:00:00Z"),
      resolvedAt: new Date("2026-08-29T11:30:00Z"),
    });
    expect(slaStateFor(c, NOW)).toBe("ok");
  });
});

describe("computeCaseMetrics", () => {
  it("counts open cases, SLA risk/breach, and hidden content independently", () => {
    const cases = [
      makeCase({ id: "1", status: "open", slaDueAt: new Date("2026-08-29T11:00:00Z") }), // breached
      makeCase({ id: "2", status: "in_review", slaDueAt: new Date("2026-08-29T13:00:00Z") }), // at_risk
      makeCase({ id: "3", status: "open", slaDueAt: new Date("2026-09-01T00:00:00Z"), contentHidden: true }), // ok, hidden
      makeCase({ id: "4", status: "resolved", contentHidden: true }), // not open, still counted as hidden
      makeCase({ id: "5", status: "dismissed" }), // not open, not hidden
    ];

    expect(computeCaseMetrics(cases, NOW)).toEqual({
      openCases: 3,
      slaAtRisk: 1,
      slaBreached: 1,
      hiddenContent: 2,
    });
  });

  it("returns all zeros for an empty case set", () => {
    expect(computeCaseMetrics([], NOW)).toEqual({
      openCases: 0,
      slaAtRisk: 0,
      slaBreached: 0,
      hiddenContent: 0,
    });
  });
});

describe("buildPriorityQueue", () => {
  it("ranks breached before at-risk before ok, then by priority, then soonest due", () => {
    const cases = [
      makeCase({ id: "ok-low", priority: "low", slaDueAt: new Date("2026-09-01T00:00:00Z") }),
      makeCase({ id: "breached-low", priority: "low", slaDueAt: new Date("2026-08-29T10:00:00Z") }),
      makeCase({ id: "breached-critical", priority: "critical", slaDueAt: new Date("2026-08-29T11:00:00Z") }),
      makeCase({ id: "at-risk-high", priority: "high", slaDueAt: new Date("2026-08-29T13:30:00Z") }),
    ];

    const queue = buildPriorityQueue(cases, NOW);
    expect(queue.map((q) => q.id)).toEqual([
      "breached-critical",
      "breached-low",
      "at-risk-high",
      "ok-low",
    ]);
  });

  it("excludes resolved and dismissed cases", () => {
    const cases = [
      makeCase({ id: "open-1", status: "open" }),
      makeCase({ id: "resolved-1", status: "resolved" }),
      makeCase({ id: "dismissed-1", status: "dismissed" }),
    ];
    expect(buildPriorityQueue(cases, NOW).map((q) => q.id)).toEqual(["open-1"]);
  });

  it("respects the limit", () => {
    const cases = Array.from({ length: 5 }, (_, i) => makeCase({ id: `c${i}` }));
    expect(buildPriorityQueue(cases, NOW, 2)).toHaveLength(2);
  });

  it("never includes fields beyond the evidence-free allowlist, even if the source record carries more", () => {
    const withEvidence = makeCase({ id: "with-evidence", evidenceRef: "reports/secret-report-id" });
    const [item] = buildPriorityQueue([withEvidence], NOW);
    expect(Object.keys(item).sort()).toEqual(
      ["category", "id", "openedAt", "priority", "slaDueAt", "slaState", "status", "summary"].sort(),
    );
    expect(JSON.stringify(item)).not.toContain("secret-report-id");
  });
});

function makeLog(overrides: Partial<LatencyLog>): LatencyLog {
  return {
    id: "log-1",
    model: "moderation-classifier-v3",
    latencyMs: 500,
    success: true,
    recordedAt: NOW,
    ...overrides,
  };
}

describe("computeModelHealth", () => {
  it("marks a model healthy when latency and error rate are low and samples are fresh", () => {
    const logs = Array.from({ length: 10 }, (_, i) =>
      makeLog({ id: `l${i}`, latencyMs: 300 + i * 10, recordedAt: NOW }),
    );
    const [entry] = computeModelHealth(logs, NOW);
    expect(entry.status).toBe("healthy");
    expect(entry.sampleCount).toBe(10);
    expect(entry.errorRatePct).toBe(0);
  });

  it("marks a model degraded when p95 latency crosses the threshold", () => {
    const logs = [
      ...Array.from({ length: 9 }, (_, i) => makeLog({ id: `l${i}`, latencyMs: 200 })),
      makeLog({ id: "slow", latencyMs: 4000 }),
    ];
    const [entry] = computeModelHealth(logs, NOW);
    expect(entry.status).toBe("degraded");
  });

  it("marks a model down when its error rate is high", () => {
    const logs = [
      ...Array.from({ length: 8 }, (_, i) => makeLog({ id: `ok${i}`, success: true })),
      makeLog({ id: "err1", success: false }),
      makeLog({ id: "err2", success: false }),
    ];
    const [entry] = computeModelHealth(logs, NOW);
    expect(entry.errorRatePct).toBe(20);
    expect(entry.status).toBe("down");
  });

  it("marks a model down when its most recent sample is stale", () => {
    const staleTime = new Date(NOW.getTime() - 60 * 60 * 1000); // 1 hour ago
    const logs = [makeLog({ recordedAt: staleTime })];
    const [entry] = computeModelHealth(logs, NOW);
    expect(entry.status).toBe("down");
  });

  it("groups independently per model and sorts entries by model name", () => {
    const logs = [
      makeLog({ id: "b1", model: "bio-classifier" }),
      makeLog({ id: "a1", model: "abuse-detector" }),
    ];
    expect(computeModelHealth(logs, NOW).map((e) => e.model)).toEqual([
      "abuse-detector",
      "bio-classifier",
    ]);
  });

  it("returns an empty array for no samples", () => {
    expect(computeModelHealth([], NOW)).toEqual([]);
  });
});

describe("computeOverallLatencyP95", () => {
  it("returns null when there are no samples", () => {
    expect(computeOverallLatencyP95([])).toBeNull();
  });

  it("computes p95 across all models combined", () => {
    const logs = Array.from({ length: 100 }, (_, i) => makeLog({ id: `l${i}`, latencyMs: i + 1 }));
    expect(computeOverallLatencyP95(logs)).toBe(95);
  });
});
