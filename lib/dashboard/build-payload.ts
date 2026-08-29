import {
  buildPriorityQueue,
  computeCaseMetrics,
  computeModelHealth,
  computeOverallLatencyP95,
} from "./metrics";
import type { CaseRecord, DashboardPayload, LatencyLog } from "./types";

/**
 * Assembles the role-scoped dashboard response from already-fetched data.
 * A moderator's payload is built to structurally exclude AI/model-health
 * data and ops-only metrics (aiLatencyP95Ms, SLA counts) — not just have
 * them omitted by convention — so there's nothing to accidentally leak by
 * widening this function later. Pass an empty latencyLogs array for a
 * moderator request; the route handler skips fetching it entirely so a
 * moderator's request never even causes a read of that collection.
 */
export function buildDashboardPayload(
  role: "admin" | "moderator",
  cases: CaseRecord[],
  latencyLogs: LatencyLog[],
  now: Date,
): DashboardPayload {
  const caseMetrics = computeCaseMetrics(cases, now);
  const queue = buildPriorityQueue(cases, now);

  if (role === "moderator") {
    return {
      role: "moderator",
      metrics: {
        openCases: caseMetrics.openCases,
        hiddenContent: caseMetrics.hiddenContent,
      },
      queue,
    };
  }

  return {
    role: "admin",
    metrics: {
      ...caseMetrics,
      aiLatencyP95Ms: computeOverallLatencyP95(latencyLogs),
    },
    queue,
    modelHealth: computeModelHealth(latencyLogs, now),
  };
}
