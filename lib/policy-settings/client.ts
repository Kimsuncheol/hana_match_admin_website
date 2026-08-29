import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase/client";
import type { PolicyMutationInput, PolicyMutationResult, PolicySettingsResponse } from "./types";

export type PolicyClientError = "unauthenticated" | "forbidden" | "invalid" | "conflict" | "network";

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "";
}

function mapError(error: unknown): PolicyClientError {
  const code = errorCode(error);
  if (code.includes("unauthenticated")) return "unauthenticated";
  if (code.includes("permission-denied")) return "forbidden";
  if (code.includes("invalid-argument")) return "invalid";
  if (code.includes("aborted") || code.includes("failed-precondition") || code.includes("not-found")) return "conflict";
  return "network";
}

export async function fetchPolicySettings(): Promise<{ ok: true; data: PolicySettingsResponse } | { ok: false; error: PolicyClientError }> {
  try {
    const callable = httpsCallable<Record<string, never>, PolicySettingsResponse>(getFirebaseFunctions(), "getPolicySettings");
    const result = await callable({});
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function mutatePolicySettings(input: PolicyMutationInput): Promise<{ ok: true; data: PolicyMutationResult } | { ok: false; error: PolicyClientError }> {
  try {
    const callable = httpsCallable<PolicyMutationInput, PolicyMutationResult>(getFirebaseFunctions(), "mutatePolicySettings");
    const result = await callable(input);
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}
