import type { User } from "firebase/auth";
import type { DashboardPayload } from "./types";

export type DashboardFetchError =
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "network" };

export type DashboardFetchResult =
  | { ok: true; data: DashboardPayload }
  | { ok: false; error: DashboardFetchError };

export async function fetchDashboard(user: User): Promise<DashboardFetchResult> {
  try {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (response.status === 401) return { ok: false, error: { kind: "unauthenticated" } };
    if (response.status === 403) return { ok: false, error: { kind: "forbidden" } };
    if (!response.ok) return { ok: false, error: { kind: "network" } };

    const data: DashboardPayload = await response.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
}
