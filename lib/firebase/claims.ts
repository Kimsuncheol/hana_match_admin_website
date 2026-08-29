export type AdminClaims = {
  admin?: boolean;
  role?: string;
};

/**
 * Source of truth for "is this user allowed into the admin console".
 * Claims come only from a verified Firebase ID token — never from client state
 * a user could set themselves (e.g. Firestore profile fields).
 */
export function isAdminClaim(claims: AdminClaims | null | undefined): boolean {
  return claims?.admin === true;
}
