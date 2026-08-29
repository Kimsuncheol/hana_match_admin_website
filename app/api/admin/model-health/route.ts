import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/firebase-admin/authorize";
import { fetchModelHealthInputs } from "@/lib/firebase-admin/model-health-data";
import { getAdminAuth } from "@/lib/firebase-admin/server";
import { aggregateModelHealth } from "@/lib/model-health/aggregate";

/** Aggregate-only model operations data. Moderator requests fail before any model collection is read. */
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, getAdminAuth(), ["admin"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "Cache-Control": "private, no-store" } });

  try {
    const { reviews, inferences, deployment } = await fetchModelHealthInputs();
    return NextResponse.json(aggregateModelHealth(reviews, inferences, deployment, new Date()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "model-health-unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
