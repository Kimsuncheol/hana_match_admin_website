import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin/server";
import { assignRoleForVerifiedUser } from "@/lib/firebase-admin/assign-role";

/**
 * Called once, right after sign-up, with the new account's own fresh ID
 * token. The UID/email used for the role decision come only from that
 * token after server-side verification — never from the request body — so
 * a client cannot request a role for another account or claim a domain it
 * doesn't actually own.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!idToken) {
    return NextResponse.json({ error: "missing-id-token" }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "invalid-id-token" }, { status: 401 });
  }

  const result = await assignRoleForVerifiedUser({
    uid: decoded.uid,
    email: decoded.email,
    allowedDomainsCsv: process.env.ADMIN_ALLOWED_EMAIL_DOMAINS,
    auth: getAdminAuth(),
    profiles: getAdminFirestore().collection("adminProfiles"),
  });

  return NextResponse.json(result);
}
