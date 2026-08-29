import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase-admin/server", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
}));

const updateCaseAssignment = vi.fn();
vi.mock("@/lib/firebase-admin/moderation-data", () => ({
  updateCaseAssignment: (...args: unknown[]) => updateCaseAssignment(...args),
}));

const { POST } = await import("./route");

function request(body: unknown, token: string | null = "token") {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("https://example.com/api/admin/moderation/cases/case-1/assign", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ caseId: "case-1" }) };

describe("POST /api/admin/moderation/cases/[caseId]/assign", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    updateCaseAssignment.mockReset().mockResolvedValue({ ok: true });
  });

  it("rejects unauthenticated assignment", async () => {
    const response = await POST(request({ action: "assign_to_me" }, null), context);
    expect(response.status).toBe(401);
    expect(updateCaseAssignment).not.toHaveBeenCalled();
  });

  it("does not accept case state or an arbitrary assignee from the client", async () => {
    verifyIdToken.mockResolvedValue({ uid: "mod-1", email: "mod@example.com", admin: true, role: "moderator" });
    const response = await POST(
      request({ action: "assign_to_me", status: "resolved", assigneeUid: "someone-else" }),
      context,
    );
    expect(response.status).toBe(400);
    expect(updateCaseAssignment).not.toHaveBeenCalled();
  });

  it("derives the assignee from the verified token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "mod-1", email: "mod@example.com", admin: true, role: "moderator" });
    const response = await POST(request({ action: "assign_to_me" }), context);
    expect(response.status).toBe(200);
    expect(updateCaseAssignment).toHaveBeenCalledWith({
      caseId: "case-1",
      actorUid: "mod-1",
      actorLabel: "mod@example.com",
      action: "assign_to_me",
    });
  });
});

