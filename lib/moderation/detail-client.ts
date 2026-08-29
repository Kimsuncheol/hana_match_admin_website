import type { User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase/client";
import type {
  CaseDetailDto,
  ModerationActionInput,
  ModerationActionResult,
} from "./detail-types";

export type DetailClientError = "unauthenticated" | "forbidden" | "not-found" | "conflict" | "network";

export async function fetchCaseDetail(
  user: User,
  caseId: string,
): Promise<{ ok: true; data: CaseDetailDto } | { ok: false; error: DetailClientError }> {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/moderation/cases/${encodeURIComponent(caseId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 401) return { ok: false, error: "unauthenticated" };
    if (response.status === 403) return { ok: false, error: "forbidden" };
    if (response.status === 404) return { ok: false, error: "not-found" };
    if (!response.ok) return { ok: false, error: "network" };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function submitModerationAction(
  input: ModerationActionInput,
): Promise<{ ok: true; data: ModerationActionResult } | { ok: false; error: DetailClientError }> {
  try {
    const callable = httpsCallable<ModerationActionInput, ModerationActionResult>(
      getFirebaseFunctions(),
      "moderateCase",
    );
    const result = await callable(input);
    return { ok: true, data: result.data };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.includes("unauthenticated")) return { ok: false, error: "unauthenticated" };
    if (code.includes("permission-denied")) return { ok: false, error: "forbidden" };
    if (code.includes("aborted") || code.includes("failed-precondition") || code.includes("already-exists")) {
      return { ok: false, error: "conflict" };
    }
    if (code.includes("not-found")) return { ok: false, error: "not-found" };
    return { ok: false, error: "network" };
  }
}

