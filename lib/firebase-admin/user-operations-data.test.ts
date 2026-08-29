import { describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_FILTERS } from "@/lib/user-operations/types";

vi.mock("server-only", () => ({}));
const authUser = {
  uid: "abcdefghijklmnop",
  email: "sensitive.person@example.com",
  phoneNumber: "+821012345678",
  displayName: "Sensitive Person",
  emailVerified: true,
  disabled: false,
  metadata: { lastSignInTime: "2026-08-29T10:00:00Z" },
};
const listUsers = vi.fn(async () => ({ users: [authUser], pageToken: "next-token" }));
const getUser = vi.fn(async () => authUser);
const getUserByEmail = vi.fn(async () => authUser);

const profileGet = vi.fn(async () => ({ data: () => ({ trustFlags: ["watch"], lastActivityAt: new Date("2026-08-29T11:00:00Z"), rawIdentity: "secret" }) }));
const moderationGet = vi.fn(async () => ({ data: () => ({ version: 2, talkRateLimitedUntil: new Date("2099-01-01T00:00:00Z") }) }));
const historyGet = vi.fn(async () => ({ docs: [{ data: () => ({ action: "warn_user", caseId: "case-1", reason: "정책 위반 근거", createdAt: new Date("2026-08-29T09:00:00Z"), rawEvidence: "never-return" }) }] }));
const collection = vi.fn((name: string) => {
  if (name === "userProfiles") return { doc: () => ({ get: profileGet }) };
  if (name === "userModerationStates") return { doc: () => ({ get: moderationGet }) };
  if (name === "auditLogs") return { where: () => ({ orderBy: () => ({ limit: () => ({ get: historyGet }) }) }) };
  throw new Error(`unexpected collection ${name}`);
});

vi.mock("./server", () => ({
  getAdminAuth: () => ({ listUsers, getUser, getUserByEmail }),
  getAdminFirestore: () => ({ collection }),
}));

const { queryUserOperations } = await import("./user-operations-data");

describe("user operations server projection", () => {
  it("masks identity and includes narrowly scoped evidence context for admins", async () => {
    const result = await queryUserOperations(DEFAULT_USER_FILTERS, "admin");
    expect(result.users[0]).toMatchObject({
      uid: "abcdefghijklmnop",
      maskedUid: "abcd…mnop",
      maskedEmail: "se***@example.com",
      maskedDisplayName: "S***",
      verification: { emailVerified: true },
      status: "active",
      trustFlags: ["watch"],
      version: 2,
    });
    expect(result.users[0].recentModerationHistory[0].evidenceContext).toEqual({ caseId: "case-1", reason: "정책 위반 근거" });
    expect(JSON.stringify(result)).not.toContain("sensitive.person@example.com");
    expect(JSON.stringify(result)).not.toContain("+821012345678");
    expect(JSON.stringify(result)).not.toContain("never-return");
  });

  it("structurally removes evidence context for moderators", async () => {
    const result = await queryUserOperations(DEFAULT_USER_FILTERS, "moderator");
    expect(result.role).toBe("moderator");
    expect(result.users[0].recentModerationHistory[0]).not.toHaveProperty("evidenceContext");
    expect(JSON.stringify(result)).not.toContain("정책 위반 근거");
    expect(JSON.stringify(result)).not.toContain("case-1");
  });
});

