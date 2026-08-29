import { describe, expect, it } from "vitest";
import { buildDashboardPayload } from "./build-payload";
import type { CaseRecord, LatencyLog } from "./types";

const NOW = new Date("2026-08-29T12:00:00Z");

const cases: CaseRecord[] = [
  {
    id: "c1",
    status: "open",
    priority: "critical",
    category: "message",
    openedAt: new Date("2026-08-29T00:00:00Z"),
    slaDueAt: new Date("2026-08-29T11:00:00Z"),
    contentHidden: true,
    summary: "reported for harassment",
    evidenceRef: "reports/should-never-leak",
  },
];

const logs: LatencyLog[] = [
  { id: "l1", model: "abuse-detector", latencyMs: 6000, success: false, recordedAt: NOW },
];

describe("buildDashboardPayload", () => {
  it("gives admins the full payload: metrics, queue, and model health", () => {
    const payload = buildDashboardPayload("admin", cases, logs, NOW);
    expect(payload.role).toBe("admin");
    expect(payload.metrics).toMatchObject({ openCases: 1, slaBreached: 1, hiddenContent: 1 });
    if (payload.role === "admin") {
      expect(payload.modelHealth).toHaveLength(1);
      expect(payload.metrics.aiLatencyP95Ms).toBe(6000);
    }
  });

  it("gives moderators only openCases/hiddenContent and the queue — no SLA breach count, no latency, no model health", () => {
    const payload = buildDashboardPayload("moderator", cases, logs, NOW);
    expect(payload.role).toBe("moderator");
    expect(payload.metrics).toEqual({ openCases: 1, hiddenContent: 1 });
    expect("modelHealth" in payload).toBe(false);
    expect("aiLatencyP95Ms" in payload.metrics).toBe(false);
  });

  it("never leaks evidenceRef or any non-allowlisted case field in either role's queue", () => {
    const adminPayload = buildDashboardPayload("admin", cases, logs, NOW);
    const modPayload = buildDashboardPayload("moderator", cases, logs, NOW);
    expect(JSON.stringify(adminPayload)).not.toContain("should-never-leak");
    expect(JSON.stringify(modPayload)).not.toContain("should-never-leak");
  });

  it("handles no data gracefully for both roles", () => {
    expect(buildDashboardPayload("admin", [], [], NOW)).toEqual({
      role: "admin",
      metrics: { openCases: 0, slaAtRisk: 0, slaBreached: 0, hiddenContent: 0, aiLatencyP95Ms: null },
      queue: [],
      modelHealth: [],
    });
    expect(buildDashboardPayload("moderator", [], [], NOW)).toEqual({
      role: "moderator",
      metrics: { openCases: 0, hiddenContent: 0 },
      queue: [],
    });
  });
});
