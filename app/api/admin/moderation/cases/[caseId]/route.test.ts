import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase-admin/server", () => ({ getAdminAuth: () => ({ verifyIdToken }) }));

const fetchModerationCaseDetail = vi.fn();
vi.mock("@/lib/firebase-admin/moderation-detail", () => ({
  fetchModerationCaseDetail: (...args: unknown[]) => fetchModerationCaseDetail(...args),
}));

const { GET } = await import("./route");
const context = { params: Promise.resolve({ caseId: "case-1" }) };

function request(token: string | null = "token") {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("https://example.com/api/admin/moderation/cases/case-1", { headers });
}

describe("GET /api/admin/moderation/cases/[caseId]", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    fetchModerationCaseDetail.mockReset().mockResolvedValue({ id: "case-1", maskedEvidence: { preview: "masked", redacted: true } });
  });

  it("rejects missing authentication before reading evidence", async () => {
    const response = await GET(request(null), context);
    expect(response.status).toBe(401);
    expect(fetchModerationCaseDetail).not.toHaveBeenCalled();
  });

  it("rejects a user without a moderation role", async () => {
    verifyIdToken.mockResolvedValue({ uid: "user-1", admin: false });
    const response = await GET(request(), context);
    expect(response.status).toBe(403);
    expect(fetchModerationCaseDetail).not.toHaveBeenCalled();
  });

  it("returns masked detail without shared caching to a moderator", async () => {
    verifyIdToken.mockResolvedValue({ uid: "mod-1", admin: true, role: "moderator" });
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ maskedEvidence: { preview: "masked", redacted: true } });
  });
});

