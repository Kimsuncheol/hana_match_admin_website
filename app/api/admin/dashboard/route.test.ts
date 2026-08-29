import { describe, expect, it, vi, beforeEach } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase-admin/server", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminFirestore: () => {
    throw new Error("getAdminFirestore should not be called directly by the route");
  },
}));

const fetchRelevantCases = vi.fn();
const fetchRecentLatencyLogs = vi.fn();
vi.mock("@/lib/firebase-admin/dashboard-data", () => ({
  fetchRelevantCases: (...args: unknown[]) => fetchRelevantCases(...args),
  fetchRecentLatencyLogs: (...args: unknown[]) => fetchRecentLatencyLogs(...args),
}));

const { GET } = await import("./route");

function requestWith(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("https://example.com/api/admin/dashboard", { headers });
}

describe("GET /api/admin/dashboard", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    fetchRelevantCases.mockReset().mockResolvedValue([]);
    fetchRecentLatencyLogs.mockReset().mockResolvedValue([]);
  });

  it("rejects a request with no token", async () => {
    const response = await GET(requestWith(null));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "missing-id-token" });
    expect(fetchRelevantCases).not.toHaveBeenCalled();
  });

  it("rejects a token that fails verification", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    const response = await GET(requestWith("Bearer garbage"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid-id-token" });
  });

  it("rejects a signed-in user with no admin claim (403, and never reads dashboard data)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", admin: false });
    const response = await GET(requestWith("Bearer tok"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "insufficient-role" });
    expect(fetchRelevantCases).not.toHaveBeenCalled();
    expect(fetchRecentLatencyLogs).not.toHaveBeenCalled();
  });

  it("returns the full payload for an admin, including model health and latency", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", admin: true, role: "admin" });
    fetchRelevantCases.mockResolvedValue([]);
    fetchRecentLatencyLogs.mockResolvedValue([
      { id: "l1", model: "abuse-detector", latencyMs: 500, success: true, recordedAt: new Date() },
    ]);

    const response = await GET(requestWith("Bearer tok"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.role).toBe("admin");
    expect(body.modelHealth).toHaveLength(1);
    expect(fetchRecentLatencyLogs).toHaveBeenCalledTimes(1);
  });

  it("returns the reduced payload for a moderator and never fetches latency logs at all", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", admin: true, role: "moderator" });
    fetchRelevantCases.mockResolvedValue([]);

    const response = await GET(requestWith("Bearer tok"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.role).toBe("moderator");
    expect(body).not.toHaveProperty("modelHealth");
    expect(body.metrics).toEqual({ openCases: 0, hiddenContent: 0 });
    // The point isn't just that the field is absent from the response —
    // the AI latency collection must never even be read for a moderator.
    expect(fetchRecentLatencyLogs).not.toHaveBeenCalled();
  });
});
