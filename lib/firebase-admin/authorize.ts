export type AdminRole = "admin" | "moderator";

export type AuthorizedRequest = {
  ok: true;
  uid: string;
  email: string | undefined;
  role: AdminRole;
};

export type UnauthorizedRequest = {
  ok: false;
  status: 401 | 403;
  error: "missing-id-token" | "invalid-id-token" | "insufficient-role";
};

export type AuthorizationResult = AuthorizedRequest | UnauthorizedRequest;

export interface IdTokenVerifier {
  verifyIdToken(idToken: string): Promise<{
    uid: string;
    email?: string;
    admin?: boolean;
    role?: string;
  }>;
}

function toRole(claims: { admin?: boolean; role?: string }): AdminRole | null {
  if (claims.admin !== true) return null;
  // Existing operational APIs treat the explicitly higher-privileged role
  // as full admin. The policy callables still check for the exact
  // `superAdmin` claim independently.
  if (claims.role === "superAdmin") return "admin";
  // Any admin-claimed account with an unrecognized/missing role string is
  // treated as the least-privileged admin-console role, not full admin —
  // an unexpected claim shape should never silently grant more access.
  return claims.role === "admin" ? "admin" : "moderator";
}

/**
 * Verifies the bearer token on a request and checks it against an
 * allowlist of roles. This is the single choke point every admin API
 * route must go through — nothing here trusts anything from the request
 * body, only the token itself (verified against Firebase, not decoded
 * client-side).
 */
export async function authorizeRequest(
  request: Request,
  verifier: IdTokenVerifier,
  allowedRoles: readonly AdminRole[],
): Promise<AuthorizationResult> {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!idToken) {
    return { ok: false, status: 401, error: "missing-id-token" };
  }

  let decoded;
  try {
    decoded = await verifier.verifyIdToken(idToken);
  } catch {
    return { ok: false, status: 401, error: "invalid-id-token" };
  }

  const role = toRole(decoded);
  if (!role || !allowedRoles.includes(role)) {
    return { ok: false, status: 403, error: "insufficient-role" };
  }

  return { ok: true, uid: decoded.uid, email: decoded.email, role };
}
