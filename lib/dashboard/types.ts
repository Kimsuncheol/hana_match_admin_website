/**
 * Domain types for the admin dashboard.
 *
 * Schema is new — not yet written to by the app/AI pipeline. See
 * README.md "Admin dashboard data model" for the Firestore shapes these
 * are read from (moderationCases, aiLatencyLogs) and what still needs to
 * wire up real ingestion.
 */

export type CaseStatus = "open" | "in_review" | "resolved" | "dismissed";
export type CasePriority = "low" | "medium" | "high" | "critical";
export type CaseCategory = "profile_photo" | "message" | "bio" | "report_user";

/**
 * Raw Firestore shape (moderationCases/{id}). May carry evidence-adjacent
 * fields (e.g. a pointer to the reported content) that must never reach
 * the client — see lib/dashboard/metrics.ts buildPriorityQueue, which
 * allowlists exactly the fields a QueueItem is allowed to carry.
 */
export type CaseRecord = {
  id: string;
  status: CaseStatus;
  priority: CasePriority;
  category: CaseCategory;
  openedAt: Date;
  slaDueAt: Date;
  resolvedAt?: Date;
  contentHidden: boolean;
  summary: string;
  /** Internal pointer only (e.g. a report/content doc id) — never surfaced to the client. */
  evidenceRef?: string;
};

export type SlaState = "ok" | "at_risk" | "breached";

/** Client-facing, evidence-free view of a case, ranked by urgency. */
export type QueueItem = {
  id: string;
  status: CaseStatus;
  priority: CasePriority;
  category: CaseCategory;
  summary: string;
  openedAt: string;
  slaDueAt: string;
  slaState: SlaState;
};

/** Raw Firestore shape (aiLatencyLogs/{id}). */
export type LatencyLog = {
  id: string;
  model: string;
  latencyMs: number;
  success: boolean;
  recordedAt: Date;
};

export type ModelStatus = "healthy" | "degraded" | "down";

export type ModelHealthEntry = {
  model: string;
  p50Ms: number;
  p95Ms: number;
  errorRatePct: number;
  sampleCount: number;
  lastSeenAt: string;
  status: ModelStatus;
};

export type DashboardMetrics = {
  openCases: number;
  slaAtRisk: number;
  slaBreached: number;
  hiddenContent: number;
  aiLatencyP95Ms: number | null;
};

/** Full payload for the "admin" role. */
export type AdminDashboardPayload = {
  role: "admin";
  metrics: DashboardMetrics;
  queue: QueueItem[];
  modelHealth: ModelHealthEntry[];
};

/** Reduced payload for the "moderator" role: no AI/model-health data, no SLA/latency ops metrics. */
export type ModeratorDashboardPayload = {
  role: "moderator";
  metrics: Pick<DashboardMetrics, "openCases" | "hiddenContent">;
  queue: QueueItem[];
};

export type DashboardPayload = AdminDashboardPayload | ModeratorDashboardPayload;
