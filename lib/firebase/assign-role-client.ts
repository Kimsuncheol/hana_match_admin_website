import type { User } from "firebase/auth";

type AssignRoleResult = { admin: boolean; role: string };

/**
 * Calls the trusted server-side role-assignment endpoint right after
 * sign-up, then forces a token refresh so the client's claims reflect
 * whatever the server actually decided. The client only ever reads the
 * outcome — it never sends a requested role.
 */
export async function requestDefaultRoleAssignment(user: User): Promise<AssignRoleResult> {
  const idToken = await user.getIdToken();

  const response = await fetch("/api/admin/assign-role", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    throw new Error(`assign-role failed with status ${response.status}`);
  }

  const result: AssignRoleResult = await response.json();
  await user.getIdTokenResult(true);
  return result;
}
