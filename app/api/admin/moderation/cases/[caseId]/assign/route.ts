import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/firebase-admin/authorize";
import { updateCaseAssignment } from "@/lib/firebase-admin/moderation-data";
import { getAdminAuth } from "@/lib/firebase-admin/server";

const CASE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const auth = await authorizeRequest(request, getAdminAuth(), ["admin", "moderator"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { caseId } = await context.params;
  if (!CASE_ID_PATTERN.test(caseId)) {
    return NextResponse.json({ error: "invalid-case-id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }
  const keys = Object.keys(body);
  const action = (body as { action?: unknown }).action;
  if (
    keys.length !== 1 ||
    keys[0] !== "action" ||
    (action !== "assign_to_me" && action !== "release")
  ) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  try {
    const result = await updateCaseAssignment({
      caseId,
      actorUid: auth.uid,
      actorLabel: auth.email ?? auth.uid,
      action,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ assigned: action === "assign_to_me" });
  } catch {
    return NextResponse.json({ error: "assignment-unavailable" }, { status: 503 });
  }
}

