import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/firebase-admin/authorize";
import { getAdminAuth } from "@/lib/firebase-admin/server";
import { queryUserOperations } from "@/lib/firebase-admin/user-operations-data";
import { parseUserOperationsFilters } from "@/lib/user-operations/query-contract";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, getAdminAuth(), ["admin", "moderator"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = parseUserOperationsFilters(new URL(request.url));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await queryUserOperations(parsed.filters, auth.role);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "users-unavailable" }, { status: 503 });
  }
}

