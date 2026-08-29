import type { CasePriority, SlaState } from "@/lib/dashboard/types";
import {
  DEFAULT_QUEUE_FILTERS,
  TARGET_TYPES,
  type AssignmentFilter,
  type ModerationQueueFilters,
  type ModerationTargetType,
} from "./types";

const PRIORITIES = new Set<CasePriority>(["low", "medium", "high", "critical"]);
const ASSIGNMENTS = new Set<AssignmentFilter>(["all", "mine", "unassigned"]);
const SLA_STATES = new Set<SlaState | "all">(["all", "ok", "at_risk", "breached"]);
const TARGET_TYPE_SET = new Set<ModerationTargetType>(TARGET_TYPES);
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;
const MAX_PAGE_SIZE = 50;

export type QueueContractResult =
  | { ok: true; filters: ModerationQueueFilters }
  | { ok: false; error: "invalid-query" };

export function parseQueueFilters(url: URL): QueueContractResult {
  const priority = url.searchParams.get("priority") ?? DEFAULT_QUEUE_FILTERS.priority;
  const language = (url.searchParams.get("language") ?? "").trim();
  const assignment = url.searchParams.get("assignment") ?? DEFAULT_QUEUE_FILTERS.assignment;
  const targetType = url.searchParams.get("targetType") ?? DEFAULT_QUEUE_FILTERS.targetType;
  const slaRisk = url.searchParams.get("slaRisk") ?? DEFAULT_QUEUE_FILTERS.slaRisk;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? DEFAULT_QUEUE_FILTERS.limit : Number(rawLimit);
  const cursor = url.searchParams.get("cursor") || undefined;

  if (
    (priority !== "all" && !PRIORITIES.has(priority as CasePriority)) ||
    (language !== "" && !LANGUAGE_PATTERN.test(language)) ||
    !ASSIGNMENTS.has(assignment as AssignmentFilter) ||
    (targetType !== "all" && !TARGET_TYPE_SET.has(targetType as ModerationTargetType)) ||
    !SLA_STATES.has(slaRisk as SlaState | "all") ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE ||
    (cursor !== undefined && decodeCursor(cursor) === null)
  ) {
    return { ok: false, error: "invalid-query" };
  }

  return {
    ok: true,
    filters: {
      priority: priority as ModerationQueueFilters["priority"],
      language: language.toLowerCase(),
      assignment: assignment as AssignmentFilter,
      targetType: targetType as ModerationQueueFilters["targetType"],
      slaRisk: slaRisk as ModerationQueueFilters["slaRisk"],
      limit,
      cursor,
    },
  };
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, offset }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined): number | null {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      v?: unknown;
      offset?: unknown;
    };
    return parsed.v === 1 && Number.isInteger(parsed.offset) && Number(parsed.offset) >= 0
      ? Number(parsed.offset)
      : null;
  } catch {
    return null;
  }
}

