import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { slaStateFor } from "@/lib/dashboard/metrics";
import type { CasePriority, CaseRecord } from "@/lib/dashboard/types";
import { decodeCursor, encodeCursor } from "@/lib/moderation/query-contract";
import type {
  ModerationQueueCase,
  ModerationQueueFilters,
  ModerationQueueResponse,
  ModerationTargetType,
} from "@/lib/moderation/types";
import { getAdminFirestore } from "./server";

const SOURCE_LIMIT = 500;
const OPEN_STATUSES = new Set(["open", "in_review"]);
const PRIORITIES = new Set<CasePriority>(["low", "medium", "high", "critical"]);
const TARGET_TYPES = new Set<ModerationTargetType>(["profile_photo", "message", "bio", "user_report"]);

type QueueSourceCase = ModerationQueueCase & { status: string };

function toDate(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as { toDate(): Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date(0);
}

function toSourceCase(id: string, data: FirebaseFirestore.DocumentData, now: Date): QueueSourceCase {
  const slaDueAt = toDate(data.slaDueAt);
  const priority = PRIORITIES.has(data.priority) ? data.priority : "low";
  const rawTargetType = data.targetType ?? data.category;
  const targetType = TARGET_TYPES.has(rawTargetType) ? rawTargetType : "user_report";
  const labels = Array.isArray(data.aiLabels)
    ? data.aiLabels.filter((label: unknown): label is string => typeof label === "string").slice(0, 4)
    : [];
  const confidence = typeof data.aiConfidence === "number"
    ? Math.min(1, Math.max(0, data.aiConfidence))
    : null;
  const caseForSla: CaseRecord = {
    id,
    status: data.status,
    priority,
    category: data.category,
    openedAt: toDate(data.openedAt),
    slaDueAt,
    contentHidden: data.contentHidden === true,
    summary: "",
  };

  return {
    id,
    status: typeof data.status === "string" ? data.status : "open",
    priority,
    language: typeof data.language === "string" ? data.language.toLowerCase() : "und",
    targetType,
    summary: typeof data.summary === "string" ? data.summary : "",
    assignedToUid: typeof data.assignedToUid === "string" ? data.assignedToUid : null,
    assignedToLabel: typeof data.assignedToLabel === "string" ? data.assignedToLabel : null,
    slaState: slaStateFor(caseForSla, now),
    slaDueAt: slaDueAt.toISOString(),
    aiContext: { labels, confidence },
  };
}

/**
 * The client supplies only allowlisted filters. All source reads, scoping,
 * evidence omission, sorting, and pagination happen inside this server DAL.
 */
export async function queryModerationCases(
  filters: ModerationQueueFilters,
  actorUid: string,
  now = new Date(),
): Promise<ModerationQueueResponse> {
  const snapshot = await getAdminFirestore()
    .collection("moderationCases")
    .where("status", "in", ["open", "in_review"])
    .orderBy("slaDueAt", "asc")
    .limit(SOURCE_LIMIT)
    .get();

  const matches = snapshot.docs
    .map((doc) => toSourceCase(doc.id, doc.data(), now))
    .filter((item) => OPEN_STATUSES.has(item.status))
    .filter((item) => filters.priority === "all" || item.priority === filters.priority)
    .filter((item) => filters.language === "" || item.language === filters.language)
    .filter((item) => filters.targetType === "all" || item.targetType === filters.targetType)
    .filter((item) => filters.slaRisk === "all" || item.slaState === filters.slaRisk)
    .filter((item) => {
      if (filters.assignment === "mine") return item.assignedToUid === actorUid;
      if (filters.assignment === "unassigned") return item.assignedToUid === null;
      return true;
    });

  const offset = decodeCursor(filters.cursor) ?? 0;
  const end = offset + filters.limit;
  return {
    items: matches.slice(offset, end).map((item) => ({
      id: item.id,
      priority: item.priority,
      language: item.language,
      targetType: item.targetType,
      summary: item.summary,
      assignedToUid: item.assignedToUid,
      assignedToLabel: item.assignedToLabel,
      slaState: item.slaState,
      slaDueAt: item.slaDueAt,
      aiContext: item.aiContext,
    })),
    pageInfo: { nextCursor: end < matches.length ? encodeCursor(end) : null },
  };
}

export type AssignmentResult =
  | { ok: true }
  | { ok: false; status: 404 | 409; error: "case-not-found" | "case-not-open" | "already-assigned" | "not-assignee" };

/** Mutates assignment fields only. Case status and review decisions are never accepted from the client. */
export async function updateCaseAssignment(params: {
  caseId: string;
  actorUid: string;
  actorLabel: string;
  action: "assign_to_me" | "release";
}): Promise<AssignmentResult> {
  const db = getAdminFirestore();
  const ref = db.collection("moderationCases").doc(params.caseId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { ok: false, status: 404, error: "case-not-found" } as const;

    const data = snapshot.data() ?? {};
    if (!OPEN_STATUSES.has(data.status)) {
      return { ok: false, status: 409, error: "case-not-open" } as const;
    }

    const assignedToUid = typeof data.assignedToUid === "string" ? data.assignedToUid : null;
    if (params.action === "assign_to_me") {
      if (assignedToUid && assignedToUid !== params.actorUid) {
        return { ok: false, status: 409, error: "already-assigned" } as const;
      }
      transaction.update(ref, {
        assignedToUid: params.actorUid,
        assignedToLabel: params.actorLabel,
        assignmentUpdatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      if (assignedToUid !== params.actorUid) {
        return { ok: false, status: 409, error: "not-assignee" } as const;
      }
      transaction.update(ref, {
        assignedToUid: null,
        assignedToLabel: null,
        assignmentUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { ok: true } as const;
  });
}
