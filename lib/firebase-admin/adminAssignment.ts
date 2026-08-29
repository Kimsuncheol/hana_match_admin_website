export type AdminAssignmentDecision = {
  admin: boolean;
  role: "admin" | "unassigned";
  reason: "no-domain-restriction" | "domain-allowed" | "domain-not-allowed" | "no-email";
};

/**
 * Decides whether a newly created account gets the default admin role.
 * Pure so it's trivially unit-testable: given an email and an (optional)
 * allowlist, what claim should be granted. The only caller is the
 * /api/admin/assign-role route (lib/firebase-admin/server.ts), which runs
 * after independently verifying the caller's Firebase ID token — nothing
 * client-side can influence this decision or its inputs.
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
