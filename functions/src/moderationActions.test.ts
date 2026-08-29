import { describe, expect, it } from "vitest";
import {
  moderationState,
  parseModerationActionInput,
  transitionPatch,
} from "./moderationActions";

describe("moderation action contract", () => {
  it("accepts an allowlisted action with a documented reason", () => {
    expect(parseModerationActionInput({
      caseId: "case-1",
      action: "warn_user",
      reason: "반복 위반이 확인되어 경고가 필요합니다.",
      expectedVersion: 3,
    })).toMatchObject({ caseId: "case-1", action: "warn_user", expectedVersion: 3 });
  });

  it("rejects arbitrary state, assignee, short reasons, and malformed corrections", () => {
    expect(parseModerationActionInput({
      caseId: "case-1",
      action: "confirm",
      reason: "충분히 구체적인 검토 사유입니다.",
      expectedVersion: 0,
      status: "suspended",
    })).toBeNull();
    expect(parseModerationActionInput({
      caseId: "case-1",
      action: "warn_user",
      reason: "짧음",
      expectedVersion: 0,
    })).toBeNull();
    expect(parseModerationActionInput({
      caseId: "case-1",
      action: "correct",
      reason: "수정 판단에 대한 충분한 근거입니다.",
      expectedVersion: 0,
    })).toBeNull();
  });

  it("builds predefined state transitions and increments the version", () => {
    const now = new Date("2026-08-29T10:00:00Z");
    const patch = transitionPatch(
      { status: "open", version: 4, warningCount: 1 },
      {
        caseId: "case-1",
        action: "correct",
        reason: "AI 라벨과 정책 기준이 일치하지 않아 수정합니다.",
        correction: "non_violation",
        expectedVersion: 4,
      },
      "mod-1",
      now,
    );
    expect(patch).toMatchObject({
      status: "resolved",
      version: 5,
      reviewOutcome: "corrected",
      humanLabel: "non_violation",
      lastModeratedBy: "mod-1",
    });
  });

  it("routes permanent suspension to two-person review without setting suspension state", () => {
    const patch = transitionPatch(
      { status: "open", version: 1 },
      {
        caseId: "case-1",
        action: "request_permanent_suspension",
        reason: "중대한 반복 위반으로 사람 검토가 필요합니다.",
        expectedVersion: 1,
      },
      "mod-1",
      new Date("2026-08-29T10:00:00Z"),
    );
    expect(patch).toMatchObject({
      status: "in_review",
      permanentSuspensionReview: { status: "pending", requiredApprovals: 2, approvals: [] },
    });
    expect(patch).not.toHaveProperty("permanentlySuspended");
    expect(patch).not.toHaveProperty("suspended");
  });

  it("creates an audit-safe moderation snapshot without evidence fields", () => {
    const snapshot = moderationState({
      status: "open",
      version: 2,
      evidenceText: "raw private content",
      targetUid: "user-1",
      contentHidden: false,
    });
    expect(snapshot).toMatchObject({ status: "open", version: 2, contentHidden: false });
    expect(JSON.stringify(snapshot)).not.toContain("raw private content");
    expect(snapshot).not.toHaveProperty("evidenceText");
  });
});

