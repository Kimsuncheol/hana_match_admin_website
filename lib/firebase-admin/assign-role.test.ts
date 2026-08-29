import { describe, expect, it } from "vitest";
import { assignRoleForVerifiedUser, type AdminProfileCollection, type ClaimsAuth } from "./assign-role";

function fakeProfiles(seed: Record<string, Record<string, unknown>> = {}): AdminProfileCollection {
  const store = { ...seed };
  return {
    doc(uid: string) {
      return {
        async get() {
          const data = store[uid];
          return { exists: data !== undefined, data: () => data };
        },
        async set(data: Record<string, unknown>) {
          store[uid] = data;
        },
      };
    },
  };
}

function fakeAuth(): ClaimsAuth & { calls: Array<{ uid: string; claims: Record<string, unknown> | null }> } {
  const calls: Array<{ uid: string; claims: Record<string, unknown> | null }> = [];
  return {
    calls,
    async setCustomUserClaims(uid, claims) {
      calls.push({ uid, claims });
    },
  };
}

describe("assignRoleForVerifiedUser", () => {
  it("grants admin and writes a profile on first assignment when no domain restriction is set", async () => {
    const auth = fakeAuth();
    const profiles = fakeProfiles();

    const result = await assignRoleForVerifiedUser({
      uid: "uid-1",
      email: "new-admin@anywhere.com",
      allowedDomainsCsv: "",
      auth,
      profiles,
    });

    expect(result).toEqual({ admin: true, role: "admin" });
    expect(auth.calls).toEqual([{ uid: "uid-1", claims: { admin: true, role: "admin" } }]);

    const stored = await profiles.doc("uid-1").get();
    expect(stored.exists).toBe(true);
    expect(stored.data()).toMatchObject({ email: "new-admin@anywhere.com", role: "admin" });
  });

  it("denies admin for a domain not on the allowlist, and still records the attempt", async () => {
    const auth = fakeAuth();
    const profiles = fakeProfiles();

    const result = await assignRoleForVerifiedUser({
      uid: "uid-2",
      email: "random@gmail.com",
      allowedDomainsCsv: "hanamatch.com",
      auth,
      profiles,
    });

    expect(result).toEqual({ admin: false, role: "unassigned" });
    expect(auth.calls).toEqual([{ uid: "uid-2", claims: { admin: false, role: "unassigned" } }]);
  });

  it("never re-runs the decision for a uid that already has a profile (idempotent)", async () => {
    const auth = fakeAuth();
    // Simulates an operator having manually revoked this admin's access
    // after the fact: the stored role is now "unassigned" even though the
    // email domain would currently pass the allowlist.
    const profiles = fakeProfiles({
      "uid-3": { email: "demoted@hanamatch.com", role: "unassigned" },
    });

    const result = await assignRoleForVerifiedUser({
      uid: "uid-3",
      email: "demoted@hanamatch.com",
      allowedDomainsCsv: "hanamatch.com",
      auth,
      profiles,
    });

    expect(result).toEqual({ admin: false, role: "unassigned" });
    // setCustomUserClaims must never be called again for an already-processed uid.
    expect(auth.calls).toEqual([]);
  });

  it("denies admin when the token has no email, without throwing", async () => {
    const auth = fakeAuth();
    const profiles = fakeProfiles();

    const result = await assignRoleForVerifiedUser({
      uid: "uid-4",
      email: undefined,
      allowedDomainsCsv: "hanamatch.com",
      auth,
      profiles,
    });

    expect(result).toEqual({ admin: false, role: "unassigned" });
    expect(auth.calls).toEqual([{ uid: "uid-4", claims: { admin: false, role: "unassigned" } }]);
  });
});
