import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase-admin/server", () => ({ getAdminAuth: () => ({ verifyIdToken }) }));
const fetchModelHealthInputs = vi.fn();
vi.mock("@/lib/firebase-admin/model-health-data", () => ({ fetchModelHealthInputs: (...args: unknown[]) => fetchModelHealthInputs(...args) }));
const { GET } = await import("./route");

function request(token?: string) {
  return new Request("https://example.com/api/admin/model-health", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

const deployment = { modelVersion: "mod-v7", rolloutMode: "percentage", rolloutPercentage: 20, rollbackTarget: "mod-v6", stateVersion: 4, updatedAt: null };

describe("GET /api/admin/model-health", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    fetchModelHealthInputs.mockReset().mockResolvedValue({ reviews: [], inferences: [], deployment });
  });

  it("rejects unauthenticated requests without reading model collections", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(fetchModelHealthInputs).not.toHaveBeenCalled();
  });

  it("rejects moderators before any aggregate query", async () => {
    verifyIdToken.mockResolvedValue({ uid: "mod", admin: true, role: "moderator" });
    const response = await GET(request("token"));
    expect(response.status).toBe(403);
    expect(fetchModelHealthInputs).not.toHaveBeenCalled();
  });

  it("returns only aggregate fields to an admin", async () => {
    verifyIdToken.mockResolvedValue({ uid: "admin", admin: true, role: "admin" });
    fetchModelHealthInputs.mockResolvedValue({
      reviews: [{ language: "ko", agreed: true, overridden: false }],
      inferences: [{ latencyMs: 240, success: true }],
      deployment,
      rawPrompt: "must never escape",
      providerResponse: { hidden: true },
    });
    const response = await GET(request("token"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.agreement[0]).toMatchObject({ language: "ko", agreementPct: 100 });
    expect(body.medianLatencyMs).toBe(240);
    expect(JSON.stringify(body)).not.toContain("must never escape");
    expect(body).not.toHaveProperty("providerResponse");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("accepts superAdmin as inherited admin access for aggregate reads", async () => {
    verifyIdToken.mockResolvedValue({ uid: "root", admin: true, role: "superAdmin" });
    expect((await GET(request("token"))).status).toBe(200);
  });
});
