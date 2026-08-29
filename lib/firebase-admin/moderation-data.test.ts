import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_QUEUE_FILTERS } from "@/lib/moderation/types";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
const get = vi.fn(async () => ({ docs: state.docs }));
const limit = vi.fn(() => ({ get }));
const orderBy = vi.fn(() => ({ limit }));
const where = vi.fn(() => ({ orderBy }));
const collection = vi.fn(() => ({ where }));

vi.mock("./server", () => ({
  getAdminFirestore: () => ({ collection }),
}));

const { queryModerationCases } = await import("./moderation-data");

describe("moderation queue data projection", () => {
  beforeEach(() => {
    get.mockClear();
    state.docs = [
      {
        id: "case-1",
        data: () => ({
          status: "open",
          priority: "high",
          category: "message",
          language: "ko",
          summary: "검토용 요약",
          assignedToUid: "mod-1",
          assignedToLabel: "mod@example.com",
          openedAt: new Date("2026-08-29T00:00:00Z"),
          slaDueAt: new Date("2026-08-29T11:00:00Z"),
          contentHidden: true,
          aiLabels: ["harassment"],
          aiConfidence: 0.91,
          evidenceRef: "private/evidence/123",
          rawMessage: "must never leave server",
        }),
      },
    ];
  });

  it("returns an evidence-free allowlisted DTO", async () => {
    const result = await queryModerationCases(
      DEFAULT_QUEUE_FILTERS,
      "mod-1",
      new Date("2026-08-29T10:00:00Z"),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "case-1",
      aiContext: { labels: ["harassment"], confidence: 0.91 },
      slaState: "at_risk",
    });
    expect(JSON.stringify(result)).not.toContain("evidenceRef");
    expect(JSON.stringify(result)).not.toContain("rawMessage");
    expect(JSON.stringify(result)).not.toContain("must never leave server");
  });

  it("resolves the mine filter from the verified actor uid", async () => {
    const mine = await queryModerationCases(
      { ...DEFAULT_QUEUE_FILTERS, assignment: "mine" },
      "mod-1",
      new Date("2026-08-29T10:00:00Z"),
    );
    const someoneElse = await queryModerationCases(
      { ...DEFAULT_QUEUE_FILTERS, assignment: "mine" },
      "mod-2",
      new Date("2026-08-29T10:00:00Z"),
    );
    expect(mine.items).toHaveLength(1);
    expect(someoneElse.items).toHaveLength(0);
  });
});

