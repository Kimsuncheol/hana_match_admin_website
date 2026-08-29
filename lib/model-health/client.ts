import type { User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase/client";
import type { ModelHealthPayload, RolloutModeChangeInput, RolloutModeChangeResult } from "./types";

export type ModelHealthError = "unauthenticated" | "forbidden" | "invalid" | "conflict" | "network";

function callableError(error: unknown): ModelHealthError {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("unauthenticated")) return "unauthenticated";
  if (code.includes("permission-denied")) return "forbidden";
  if (code.includes("invalid-argument")) return "invalid";
  if (code.includes("aborted") || code.includes("failed-precondition")) return "conflict";
  return "network";
}

export async function fetchModelHealth(user: User): Promise<{ ok: true; data: ModelHealthPayload } | { ok: false; error: ModelHealthError }> {
  try {
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/model-health", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (response.status === 401) return { ok: false, error: "unauthenticated" };
    if (response.status === 403) return { ok: false, error: "forbidden" };
    if (!response.ok) return { ok: false, error: "network" };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function changeModelRollout(input: RolloutModeChangeInput): Promise<{ ok: true; data: RolloutModeChangeResult } | { ok: false; error: ModelHealthError }> {
  try {
    const callable = httpsCallable<RolloutModeChangeInput, RolloutModeChangeResult>(getFirebaseFunctions(), "changeModelRollout");
    const result = await callable(input);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: callableError(error) };
  }
}
