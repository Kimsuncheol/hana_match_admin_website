import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/firebase-admin/authorize";
import { queryModerationCases } from "@/lib/firebase-admin/moderation-data";
import { getAdminAuth } from "@/lib/firebase-admin/server";
import { parseQueueFilters } from "@/lib/moderation/query-contract";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, getAdminAuth(), ["admin", "moderator"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = parseQueueFilters(new URL(request.url));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const payload = await queryModerationCases(parsed.filters, auth.uid);
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "queue-unavailable" }, { status: 503 });
  }
}

