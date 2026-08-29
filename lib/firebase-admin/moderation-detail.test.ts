import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ exists: true, data: {} as Record<string, unknown> }));
const get = vi.fn(async () => ({ exists: state.exists, data: () => state.data }));
const doc = vi.fn(() => ({ get }));
const collection = vi.fn(() => ({ doc }));
vi.mock("./server", () => ({ getAdminFirestore: () => ({ collection }) }));

const { fetchModerationCaseDetail, maskEvidence } = await import("./moderation-detail");

describe("moderation case detail projection", () => {
  beforeEach(() => {
    state.exists = true;
    state.data = {
      status: "open",
      version: 2,
      priority: "critical",
      category: "message",
      language: "ko",
      assignedToUid: "mod-1",
      openedAt: new Date("2026-08-29T00:00:00Z"),
      slaDueAt: new Date("2026-08-29T11:00:00Z"),
      evidenceText: "연락처 test.person@example.com, 010-1234-5678",
      rawEvidenceRef: "private/path",
      aiLabels: ["harassment"],
      aiConfidence: 0.93,
      rulesHit: ["TALK-4.2"],
      aiSuggestion: {
        recommendedAction: "warn_user",
        rationale: "반복적 괴롭힘 표현",
        policyBasis: ["TALK-4.2"],
        caution: "맥락 확인 필요",
      },
      userHistorySummary: { priorCases: 3, warnings: 1, accountAgeDays: 100 },
    };
  });

  it("masks evidence on the server and returns an allowlisted detail DTO", async () => {
    const detail = await fetchModerationCaseDetail("case-1", new Date("2026-08-29T10:00:00Z"));
    expect(detail).toMatchObject({
      id: "case-1",
      version: 2,
      targetType: "message",
      aiContext: { labels: ["harassment"], confidence: 0.93, rulesHit: ["TALK-4.2"] },
      sla: { state: "at_risk" },
    });
    expect(detail?.maskedEvidence.preview).toContain("te***@example.com");
    expect(detail?.maskedEvidence.preview).toContain("[전화번호 마스킹]");
    expect(JSON.stringify(detail)).not.toContain("private/path");
    expect(JSON.stringify(detail)).not.toContain("rawEvidenceRef");
  });

  it("limits and masks common identifiers", () => {
    expect(maskEvidence("person@example.com 900101-1234567")).not.toContain("person@example.com");
    expect(maskEvidence("person@example.com 900101-1234567")).toContain("[식별번호 마스킹]");
  });
});

