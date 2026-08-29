import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase-admin/server", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
}));

const queryModerationCases = vi.fn();
vi.mock("@/lib/firebase-admin/moderation-data", () => ({
  queryModerationCases: (...args: unknown[]) => queryModerationCases(...args),
}));

const { GET } = await import("./route");

function request(query = "", token: string | null = "token") {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`https://example.com/api/admin/moderation/cases${query}`, { headers });
}

describe("GET /api/admin/moderation/cases", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    queryModerationCases.mockReset().mockResolvedValue({ items: [], pageInfo: { nextCursor: null } });
  });

  it("rejects unauthenticated requests before reading cases", async () => {
    const response = await GET(request("", null));
    expect(response.status).toBe(401);
    expect(queryModerationCases).not.toHaveBeenCalled();
  });

  it("rejects users without an admin-console role", async () => {
    verifyIdToken.mockResolvedValue({ uid: "user-1", admin: false });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(queryModerationCases).not.toHaveBeenCalled();
  });

  it("rejects invalid filters before querying Firestore", async () => {
    verifyIdToken.mockResolvedValue({ uid: "mod-1", admin: true, role: "moderator" });
    const response = await GET(request("?priority=owner"));
    expect(response.status).toBe(400);
    expect(queryModerationCases).not.toHaveBeenCalled();
  });

  it("passes normalized filters and the verified actor uid to the DAL", async () => {
    verifyIdToken.mockResolvedValue({ uid: "mod-1", admin: true, role: "moderator" });
    const response = await GET(request("?priority=high&language=KO&assignment=mine"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(queryModerationCases).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "high", language: "ko", assignment: "mine" }),
      "mod-1",
    );
  });
});

