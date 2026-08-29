import type {
  CaseRecord,
  LatencyLog,
  ModelHealthEntry,
  ModelStatus,
  QueueItem,
  SlaState,
} from "./types";

/** A case within this many ms of its SLA deadline (but not yet past it) counts as "at risk". */
export const SLA_RISK_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

const PRIORITY_RANK: Record<CaseRecord["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SLA_STATE_RANK: Record<SlaState, number> = {
  breached: 0,
  at_risk: 1,
  ok: 2,
};

const OPEN_STATUSES = new Set<CaseRecord["status"]>(["open", "in_review"]);

export function slaStateFor(caseRecord: CaseRecord, now: Date): SlaState {
  if (caseRecord.resolvedAt) return "ok";
  const msRemaining = caseRecord.slaDueAt.getTime() - now.getTime();
  if (msRemaining < 0) return "breached";
  if (msRemaining <= SLA_RISK_WINDOW_MS) return "at_risk";
  return "ok";
}

export type CaseMetrics = {
  openCases: number;
  slaAtRisk: number;
  slaBreached: number;
  hiddenContent: number;
};

/**
 * Aggregates operational counts from a set of cases. Expects `cases` to
 * already be scoped to a reasonable window by the caller (e.g. non-closed
 * cases plus recently closed ones) — this function does not filter by date.
 */
export function computeCaseMetrics(cases: CaseRecord[], now: Date): CaseMetrics {
  let openCases = 0;
  let slaAtRisk = 0;
  let slaBreached = 0;
  let hiddenContent = 0;

  for (const c of cases) {
    if (OPEN_STATUSES.has(c.status)) {
      openCases += 1;
      const state = slaStateFor(c, now);
      if (state === "at_risk") slaAtRisk += 1;
      if (state === "breached") slaBreached += 1;
    }
    if (c.contentHidden) hiddenContent += 1;
  }

  return { openCases, slaAtRisk, slaBreached, hiddenContent };
}

/**
 * Ranks open/in-review cases by urgency (breached SLA first, then at-risk,
 * then by priority and soonest deadline) and maps each to the evidence-free
 * QueueItem shape. This is the only place raw CaseRecord fields become
 * client-visible, and it does so by allowlist: any field not explicitly
 * copied here (e.g. evidenceRef) never leaves the server.
 */
export function buildPriorityQueue(cases: CaseRecord[], now: Date, limit = 20): QueueItem[] {
  return cases
    .filter((c) => OPEN_STATUSES.has(c.status))
    .map((c) => ({ case: c, slaState: slaStateFor(c, now) }))
    .sort((a, b) => {
      const slaDiff = SLA_STATE_RANK[a.slaState] - SLA_STATE_RANK[b.slaState];
      if (slaDiff !== 0) return slaDiff;
      const priorityDiff = PRIORITY_RANK[a.case.priority] - PRIORITY_RANK[b.case.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.case.slaDueAt.getTime() - b.case.slaDueAt.getTime();
    })
    .slice(0, limit)
    .map(({ case: c, slaState }): QueueItem => ({
      id: c.id,
      status: c.status,
      priority: c.priority,
      category: c.category,
      summary: c.summary,
      openedAt: c.openedAt.toISOString(),
      slaDueAt: c.slaDueAt.toISOString(),
      slaState,
    }));
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, index)];
}

/** No samples for this model within the freshness window counts as "down" (silent failure is worse than a slow one). */
const FRESHNESS_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const DEGRADED_P95_MS = 2000;
const DOWN_P95_MS = 5000;
const DEGRADED_ERROR_RATE_PCT = 5;
const DOWN_ERROR_RATE_PCT = 20;

function statusFor(p95Ms: number, errorRatePct: number, isFresh: boolean): ModelStatus {
  if (!isFresh || p95Ms >= DOWN_P95_MS || errorRatePct >= DOWN_ERROR_RATE_PCT) return "down";
  if (p95Ms >= DEGRADED_P95_MS || errorRatePct >= DEGRADED_ERROR_RATE_PCT) return "degraded";
  return "healthy";
}

/** Groups latency samples by model and summarizes health for each. */
export function computeModelHealth(logs: LatencyLog[], now: Date): ModelHealthEntry[] {
  const byModel = new Map<string, LatencyLog[]>();
  for (const log of logs) {
    const bucket = byModel.get(log.model);
    if (bucket) bucket.push(log);
    else byModel.set(log.model, [log]);
  }

  const entries: ModelHealthEntry[] = [];
  for (const [model, modelLogs] of byModel) {
    const sortedMs = modelLogs.map((l) => l.latencyMs).sort((a, b) => a - b);
    const failures = modelLogs.filter((l) => !l.success).length;
    const errorRatePct = (failures / modelLogs.length) * 100;
    const lastSeenAt = modelLogs.reduce(
      (latest, l) => (l.recordedAt > latest ? l.recordedAt : latest),
      modelLogs[0].recordedAt,
    );
    const isFresh = now.getTime() - lastSeenAt.getTime() <= FRESHNESS_WINDOW_MS;
    const p95Ms = percentile(sortedMs, 95);

    entries.push({
      model,
      p50Ms: percentile(sortedMs, 50),
      p95Ms,
      errorRatePct: Math.round(errorRatePct * 10) / 10,
      sampleCount: modelLogs.length,
      lastSeenAt: lastSeenAt.toISOString(),
      status: statusFor(p95Ms, errorRatePct, isFresh),
    });
  }

  return entries.sort((a, b) => a.model.localeCompare(b.model));
}

/** Overall p95 across every model's samples, for the top-level metric tile. */
export function computeOverallLatencyP95(logs: LatencyLog[]): number | null {
  if (logs.length === 0) return null;
  const sortedMs = logs.map((l) => l.latencyMs).sort((a, b) => a - b);
  return percentile(sortedMs, 95);
}
