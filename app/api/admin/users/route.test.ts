import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase-admin/server", () => ({ getAdminAuth: () => ({ verifyIdToken }) }));
const queryUserOperations = vi.fn();
vi.mock("@/lib/firebase-admin/user-operations-data", () => ({ queryUserOperations: (...args: unknown[]) => queryUserOperations(...args) }));
const { GET } = await import("./route");

function request(query = "", token: string | null = "token") {
  const headers = new Headers(); if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`https://example.com/api/admin/users${query}`, { headers });
}

describe("GET /api/admin/users", () => {
  beforeEach(() => { verifyIdToken.mockReset(); queryUserOperations.mockReset().mockResolvedValue({ role: "admin", users: [], pageInfo: { nextCursor: null } }); });
  it("rejects unauthenticated reads before user lookup", async () => {
    const response = await GET(request("", null)); expect(response.status).toBe(401); expect(queryUserOperations).not.toHaveBeenCalled();
  });
  it("rejects users without an admin-console role", async () => {
    verifyIdToken.mockResolvedValue({ uid: "user", admin: false }); const response = await GET(request()); expect(response.status).toBe(403); expect(queryUserOperations).not.toHaveBeenCalled();
  });
  it("passes the verified role to role-shaped data projection", async () => {
    verifyIdToken.mockResolvedValue({ uid: "mod", admin: true, role: "moderator" }); const response = await GET(request("?q=user-1")); expect(response.status).toBe(200); expect(queryUserOperations).toHaveBeenCalledWith(expect.objectContaining({ query: "user-1" }), "moderator"); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects invalid filters", async () => {
    verifyIdToken.mockResolvedValue({ uid: "admin", admin: true, role: "admin" }); const response = await GET(request("?status=root")); expect(response.status).toBe(400); expect(queryUserOperations).not.toHaveBeenCalled();
  });
});

