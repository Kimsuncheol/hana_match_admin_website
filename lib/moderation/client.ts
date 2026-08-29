import type { User } from "firebase/auth";
import type { ModerationQueueFilters, ModerationQueueResponse } from "./types";

export type QueueClientError = "unauthenticated" | "forbidden" | "invalid-query" | "network";

export type QueueFetchResult =
  | { ok: true; data: ModerationQueueResponse }
  | { ok: false; error: QueueClientError };

function toSearchParams(filters: ModerationQueueFilters): URLSearchParams {
  const params = new URLSearchParams({
    priority: filters.priority,
    assignment: filters.assignment,
    targetType: filters.targetType,
    slaRisk: filters.slaRisk,
    limit: String(filters.limit),
  });
  if (filters.language) params.set("language", filters.language);
  if (filters.cursor) params.set("cursor", filters.cursor);
  return params;
}

export async function fetchModerationQueue(
  user: User,
  filters: ModerationQueueFilters,
): Promise<QueueFetchResult> {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/moderation/cases?${toSearchParams(filters)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 401) return { ok: false, error: "unauthenticated" };
    if (response.status === 403) return { ok: false, error: "forbidden" };
    if (response.status === 400) return { ok: false, error: "invalid-query" };
    if (!response.ok) return { ok: false, error: "network" };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function changeCaseAssignment(
  user: User,
  caseId: string,
  action: "assign_to_me" | "release",
): Promise<{ ok: true } | { ok: false; error: QueueClientError | "conflict" }> {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/moderation/cases/${encodeURIComponent(caseId)}/assign`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    if (response.status === 401) return { ok: false, error: "unauthenticated" };
    if (response.status === 403) return { ok: false, error: "forbidden" };
    if (response.status === 409) return { ok: false, error: "conflict" };
    if (!response.ok) return { ok: false, error: "network" };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

