import type { User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase/client";
import type {
  UserOperationInput,
  UserOperationResult,
  UserOperationsFilters,
  UserOperationsResponse,
} from "./types";

export type UserOperationsError = "unauthenticated" | "forbidden" | "invalid-query" | "conflict" | "network";

function searchParams(filters: UserOperationsFilters): URLSearchParams {
  const params = new URLSearchParams({
    verification: filters.verification,
    status: filters.status,
    restriction: filters.restriction,
    trust: filters.trust,
    limit: String(filters.limit),
  });
  if (filters.query) params.set("q", filters.query);
  if (filters.cursor) params.set("cursor", filters.cursor);
  return params;
}

export async function fetchUserOperations(
  user: User,
  filters: UserOperationsFilters,
): Promise<{ ok: true; data: UserOperationsResponse } | { ok: false; error: UserOperationsError }> {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/users?${searchParams(filters)}`, {
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

export async function submitUserOperation(
  input: UserOperationInput,
): Promise<{ ok: true; data: UserOperationResult } | { ok: false; error: UserOperationsError }> {
  try {
    const callable = httpsCallable<UserOperationInput, UserOperationResult>(getFirebaseFunctions(), "administerUser");
    const result = await callable(input);
    return { ok: true, data: result.data };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.includes("unauthenticated")) return { ok: false, error: "unauthenticated" };
    if (code.includes("permission-denied")) return { ok: false, error: "forbidden" };
    if (code.includes("aborted") || code.includes("failed-precondition")) return { ok: false, error: "conflict" };
    return { ok: false, error: "network" };
  }
}

