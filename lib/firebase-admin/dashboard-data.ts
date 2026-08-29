import "server-only";
import type { CaseRecord, LatencyLog } from "@/lib/dashboard/types";
import { getAdminFirestore } from "./server";

const CASE_QUERY_LIMIT = 500;
const LATENCY_WINDOW_HOURS = 24;
const LATENCY_WINDOW_LIMIT = 5000;

function toDate(value: unknown): Date {
  // Firestore Timestamp exposes toDate(); tolerate a plain Date too (e.g. in tests/fixtures).
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as { toDate(): Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date(0);
}

function toCaseRecord(id: string, data: FirebaseFirestore.DocumentData): CaseRecord {
  const record: CaseRecord = {
    id,
    status: data.status,
    priority: data.priority,
    category: data.category,
    openedAt: toDate(data.openedAt),
    slaDueAt: toDate(data.slaDueAt),
    contentHidden: data.contentHidden === true,
    summary: typeof data.summary === "string" ? data.summary : "",
  };
  if (data.resolvedAt) record.resolvedAt = toDate(data.resolvedAt);
  // evidenceRef intentionally not read here even though the doc may have
  // one — see CaseRecord's comment; nothing downstream needs it.
  return record;
}

/**
 * Cases the dashboard needs: every open/in-review case (for the queue and
 * SLA metrics) unioned with every case that currently has content hidden,
 * regardless of status (a resolved case can still be keeping content
 * hidden, and that should still count toward the hidden-content metric).
 * Two single-field queries + an in-memory de-dupe, since Firestore can't
 * OR across two different fields in one query. Both bounded by
 * CASE_QUERY_LIMIT — see README.md for the note on precomputed aggregates
 * if this collection grows large enough for that to matter.
 */
export async function fetchRelevantCases(): Promise<CaseRecord[]> {
  const db = getAdminFirestore();

  const [openSnapshot, hiddenSnapshot] = await Promise.all([
    db
      .collection("moderationCases")
      .where("status", "in", ["open", "in_review"])
      .orderBy("slaDueAt", "asc")
      .limit(CASE_QUERY_LIMIT)
      .get(),
    db.collection("moderationCases").where("contentHidden", "==", true).limit(CASE_QUERY_LIMIT).get(),
  ]);

  const byId = new Map<string, CaseRecord>();
  for (const doc of openSnapshot.docs) byId.set(doc.id, toCaseRecord(doc.id, doc.data()));
  for (const doc of hiddenSnapshot.docs) {
    if (!byId.has(doc.id)) byId.set(doc.id, toCaseRecord(doc.id, doc.data()));
  }
  return Array.from(byId.values());
}

export async function fetchRecentLatencyLogs(): Promise<LatencyLog[]> {
  const since = new Date(Date.now() - LATENCY_WINDOW_HOURS * 60 * 60 * 1000);

  const snapshot = await getAdminFirestore()
    .collection("aiLatencyLogs")
    .where("recordedAt", ">=", since)
    .orderBy("recordedAt", "desc")
    .limit(LATENCY_WINDOW_LIMIT)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      model: typeof data.model === "string" ? data.model : "unknown",
      latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : 0,
      success: data.success !== false,
      recordedAt: toDate(data.recordedAt),
    };
  });
}
