import "server-only";
import { slaStateFor } from "@/lib/dashboard/metrics";
import type { CasePriority, CaseRecord, CaseStatus } from "@/lib/dashboard/types";
import type { CaseDetailDto } from "@/lib/moderation/detail-types";
import type { ModerationTargetType } from "@/lib/moderation/types";
import { getAdminFirestore } from "./server";

const CASE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const STATUSES = new Set<CaseStatus>(["open", "in_review", "resolved", "dismissed"]);
const PRIORITIES = new Set<CasePriority>(["low", "medium", "high", "critical"]);
const TARGET_TYPES = new Set<ModerationTargetType>(["profile_photo", "message", "bio", "user_report"]);

function toDate(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as { toDate(): Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date(0);
}

function stringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, limit);
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/** Server-side masking: the browser never receives the original evidence field. */
export function maskEvidence(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "표시할 증거 미리보기가 없습니다.";
  return value
    .slice(0, 800)
    .replace(/([\w.+-]{1,2})[\w.+-]*(@[\w.-]+\.[A-Za-z]{2,})/g, "$1***$2")
    .replace(/(?:\+?82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}/g, "[전화번호 마스킹]")
    .replace(/\b\d{6}[- ]?[1-4]\d{6}\b/g, "[식별번호 마스킹]");
}

export async function fetchModerationCaseDetail(caseId: string, now = new Date()): Promise<CaseDetailDto | null> {
  if (!CASE_ID_PATTERN.test(caseId)) return null;
  const snapshot = await getAdminFirestore().collection("moderationCases").doc(caseId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};

  const status = STATUSES.has(data.status) ? data.status : "open";
  const priority = PRIORITIES.has(data.priority) ? data.priority : "low";
  const rawTargetType = data.targetType ?? data.category;
  const targetType = TARGET_TYPES.has(rawTargetType) ? rawTargetType : "user_report";
  const dueAt = toDate(data.slaDueAt);
  const caseForSla: CaseRecord = {
    id: caseId,
    status,
    priority,
    category: data.category,
    openedAt: toDate(data.openedAt),
    slaDueAt: dueAt,
    resolvedAt: data.resolvedAt ? toDate(data.resolvedAt) : undefined,
    contentHidden: data.contentHidden === true,
    summary: "",
  };
  const suggestion = data.aiSuggestion && typeof data.aiSuggestion === "object"
    ? (data.aiSuggestion as Record<string, unknown>)
    : null;
  const history = data.userHistorySummary && typeof data.userHistorySummary === "object"
    ? (data.userHistorySummary as Record<string, unknown>)
    : {};
  const talkRateLimitedUntil = data.talkRateLimitedUntil ? toDate(data.talkRateLimitedUntil) : null;
  const review = data.permanentSuspensionReview && typeof data.permanentSuspensionReview === "object"
    ? (data.permanentSuspensionReview as Record<string, unknown>)
    : null;

  return {
    id: caseId,
    version: count(data.version),
    status,
    priority,
    targetType,
    language: typeof data.language === "string" ? data.language.toLowerCase() : "und",
    assignedToUid: typeof data.assignedToUid === "string" ? data.assignedToUid : null,
    contentHidden: data.contentHidden === true,
    talkRateLimitedUntil: talkRateLimitedUntil && talkRateLimitedUntil.getTime() > 0 ? talkRateLimitedUntil.toISOString() : null,
    maskedEvidence: {
      preview: maskEvidence(data.maskedEvidence ?? data.evidencePreview ?? data.evidenceText),
      redacted: true,
    },
    aiContext: {
      labels: stringArray(data.aiLabels),
      confidence: typeof data.aiConfidence === "number" ? Math.min(1, Math.max(0, data.aiConfidence)) : null,
      rulesHit: stringArray(data.rulesHit, 12),
      suggestion: suggestion
        ? {
            recommendedAction: typeof suggestion.recommendedAction === "string" ? suggestion.recommendedAction : "review",
            rationale: typeof suggestion.rationale === "string" ? suggestion.rationale.slice(0, 800) : "",
            policyBasis: stringArray(suggestion.policyBasis),
            caution: typeof suggestion.caution === "string" ? suggestion.caution.slice(0, 400) : "",
          }
        : null,
    },
    userHistory: {
      priorCases: count(history.priorCases),
      confirmedViolations: count(history.confirmedViolations),
      warnings: count(history.warnings),
      temporaryRestrictions: count(history.temporaryRestrictions),
      accountAgeDays: typeof history.accountAgeDays === "number" ? count(history.accountAgeDays) : null,
    },
    sla: { state: slaStateFor(caseForSla, now), dueAt: dueAt.toISOString() },
    permanentSuspensionReview:
      review?.status === "pending"
        ? { status: "pending", requiredApprovals: Math.max(2, count(review.requiredApprovals)) }
        : null,
  };
}
