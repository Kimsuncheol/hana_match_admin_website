import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/firebase-admin/authorize";
import { fetchModerationCaseDetail } from "@/lib/firebase-admin/moderation-detail";
import { getAdminAuth } from "@/lib/firebase-admin/server";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const auth = await authorizeRequest(request, getAdminAuth(), ["admin", "moderator"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { caseId } = await context.params;
  try {
    const detail = await fetchModerationCaseDetail(caseId);
    if (!detail) return NextResponse.json({ error: "case-not-found" }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "case-unavailable" }, { status: 503 });
  }
}

