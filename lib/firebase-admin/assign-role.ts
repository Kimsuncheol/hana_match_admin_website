import { resolveAdminAssignment } from "./adminAssignment";

export interface AdminProfileDocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<unknown>;
}

export interface AdminProfileCollection {
  doc(uid: string): AdminProfileDocRef;
}

export interface ClaimsAuth {
  setCustomUserClaims(uid: string, claims: Record<string, unknown> | null): Promise<void>;
}

export type RoleAssignmentResult = { admin: boolean; role: string };

/**
 * The trusted, server-only flow: given a UID/email already verified from a
 * Firebase ID token (see app/api/admin/assign-role/route.ts), decide and
 * apply the account's role exactly once.
 *
 * Idempotent by design: once an adminProfiles/{uid} doc exists, this never
 * re-runs the domain check or touches claims again, even if called again.
 * That matters for a real threat, not just a hypothetical one — without it,
 * an operator manually revoking a user's admin claim in the console would
 * be silently undone the next time that user's client happened to call this
 * endpoint (e.g. a stale tab still on the sign-up flow).
 */
export async function assignRoleForVerifiedUser(params: {
  uid: string;
  email: string | undefined;
  allowedDomainsCsv: string | undefined;
  auth: ClaimsAuth;
  profiles: AdminProfileCollection;
}): Promise<RoleAssignmentResult> {
  const ref = params.profiles.doc(params.uid);
  const existing = await ref.get();

  if (existing.exists) {
    const data = existing.data();
    const role = typeof data?.role === "string" ? data.role : "unassigned";
    return { admin: role === "admin", role };
  }

  const decision = resolveAdminAssignment(params.email, params.allowedDomainsCsv);

  await params.auth.setCustomUserClaims(params.uid, {
    admin: decision.admin,
    role: decision.role,
  });

  await ref.set({
    email: params.email ?? null,
    role: decision.role,
    createdAt: new Date().toISOString(),
  });

  return { admin: decision.admin, role: decision.role };
}
