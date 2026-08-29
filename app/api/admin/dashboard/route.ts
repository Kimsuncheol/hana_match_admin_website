import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin/server";
import { authorizeRequest } from "@/lib/firebase-admin/authorize";
import { fetchRecentLatencyLogs, fetchRelevantCases } from "@/lib/firebase-admin/dashboard-data";
import { buildDashboardPayload } from "@/lib/dashboard/build-payload";

/**
 * Aggregate-only dashboard data. Open to both roles; the response shape
 * itself is what changes per role (see buildDashboardPayload), decided
 * entirely server-side from the verified token — a moderator cannot get
 * the admin payload by any client-side trick, because a moderator request
 * never even triggers the AI latency read below.
 */
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, getAdminAuth(), ["admin", "moderator"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const cases = await fetchRelevantCases();
  const latencyLogs = auth.role === "admin" ? await fetchRecentLatencyLogs() : [];

  const payload = buildDashboardPayload(auth.role, cases, latencyLogs, new Date());
  return NextResponse.json(payload);
}
