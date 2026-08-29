export type AdminClaims = {
  admin?: boolean;
  role?: string;
};

export type AdminRole = "superAdmin" | "admin" | "moderator";

/**
 * Source of truth for "is this user allowed into the admin console".
 * Claims come only from a verified Firebase ID token — never from client state
 * a user could set themselves (e.g. Firestore profile fields).
 */
export function isAdminClaim(claims: AdminClaims | null | undefined): boolean {
  return claims?.admin === true;
}

/**
 * Mirrors the server-side rule in lib/firebase-admin/authorize.ts: an
 * admin-claimed account with an unrecognized/missing role string reads as
 * the least-privileged "moderator", never as "admin". This only decides
 * what the client *shows* (nav links, which metrics to render) — the API
 * routes re-derive this from the token independently, so a stale or
 * tampered client value here can't widen actual data access.
 */
export function roleFromClaims(claims: AdminClaims | null | undefined): AdminRole | null {
  if (claims?.admin !== true) return null;
  if (claims.role === "superAdmin") return "superAdmin";
  return claims.role === "admin" ? "admin" : "moderator";
}
