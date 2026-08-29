export type AdminAssignmentDecision = {
  admin: boolean;
  role: "admin" | "unassigned";
  reason: "no-domain-restriction" | "domain-allowed" | "domain-not-allowed" | "no-email";
};

/**
 * Decides whether a newly created account gets the default admin role.
 * Pure and framework-free so it can be unit tested without the Firebase
 * emulator: given an email and an (optional) allowlist, what claim should
 * be granted. The caller (the beforeUserCreated trigger) is the only place
 * this decision is ever applied — nothing client-side can influence it.
 *
 * @param allowedDomainsCsv value of ADMIN_ALLOWED_EMAIL_DOMAINS, comma-separated,
 *   no leading "@" (e.g. "hanamatch.com,partner-hanamatch.jp"). Empty/undefined
 *   means no restriction: any domain is granted the admin role.
 */
export function resolveAdminAssignment(
  email: string | undefined,
  allowedDomainsCsv: string | undefined,
): AdminAssignmentDecision {
  if (!email) {
    return { admin: false, role: "unassigned", reason: "no-email" };
  }

  const allowedDomains = parseDomains(allowedDomainsCsv);
  if (allowedDomains.length === 0) {
    return { admin: true, role: "admin", reason: "no-domain-restriction" };
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && allowedDomains.includes(domain)) {
    return { admin: true, role: "admin", reason: "domain-allowed" };
  }

  return { admin: false, role: "unassigned", reason: "domain-not-allowed" };
}

function parseDomains(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
