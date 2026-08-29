import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseDetailContent } from "./case-detail-content";

const useAuthMock = vi.fn();
vi.mock("@/lib/firebase/auth-context", () => ({ useAuth: () => useAuthMock() }));

const fetchCaseDetail = vi.fn();
const submitModerationAction = vi.fn();
vi.mock("@/lib/moderation/detail-client", () => ({
  fetchCaseDetail: (...args: unknown[]) => fetchCaseDetail(...args),
  submitModerationAction: (...args: unknown[]) => submitModerationAction(...args),
}));

const user = { uid: "mod-1", email: "mod@example.com" };
const detail = {
  id: "case-1",
  version: 3,
  status: "open",
  priority: "critical",
  targetType: "message",
  language: "ko",
  assignedToUid: "mod-1",
  contentHidden: false,
  talkRateLimitedUntil: null,
  maskedEvidence: { preview: "te***@example.com: 마스킹된 메시지", redacted: true },
  aiContext: {
    labels: ["harassment"],
    confidence: 0.91,
    rulesHit: ["TALK-4.2"],
    suggestion: {
      recommendedAction: "warn_user",
      rationale: "반복적 괴롭힘 표현",
      policyBasis: ["TALK-4.2"],
      caution: "대화 맥락 확인 필요",
    },
  },
  userHistory: {
    priorCases: 4,
    confirmedViolations: 2,
    warnings: 1,
    temporaryRestrictions: 0,
    accountAgeDays: 120,
  },
  sla: { state: "at_risk", dueAt: "2026-08-30T00:00:00.000Z" },
  permanentSuspensionReview: null,
};

describe("CaseDetailContent", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user, role: "moderator", signOut: vi.fn() });
    fetchCaseDetail.mockReset().mockResolvedValue({ ok: true, data: detail });
    submitModerationAction.mockReset().mockResolvedValue({
      ok: true,
      data: { ok: true, correlationId: "corr-123", version: 4, humanReviewRequired: false },
    });
  });

  it("shows masked evidence, policy context, history, SLA, and structured AI suggestion", async () => {
    render(<CaseDetailContent caseId="case-1" />);
    expect(screen.getByRole("status", { name: "케이스 상세 불러오는 중" })).toBeInTheDocument();

    expect(await screen.findByText("te***@example.com: 마스킹된 메시지")).toBeInTheDocument();
    expect(screen.getByText("개인정보 마스킹됨")).toBeInTheDocument();
    expect(screen.getByText("신뢰도 91%")).toBeInTheDocument();
    expect(screen.getAllByText("TALK-4.2").length).toBeGreaterThan(0);
    expect(screen.getByText("반복적 괴롭힘 표현")).toBeInTheDocument();
    expect(screen.getByText("이전 케이스")).toBeInTheDocument();
    expect(screen.getByText("위험")).toBeInTheDocument();
  });

  it("submits an allowlisted action with reason and expected version to the callable client", async () => {
    render(<CaseDetailContent caseId="case-1" />);
    await screen.findByText("마스킹된 증거");

    fireEvent.change(screen.getByLabelText("조치 사유"), {
      target: { value: "정책 TALK-4.2 위반을 직접 확인했습니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 판단 확인 제출" }));

    await waitFor(() => expect(submitModerationAction).toHaveBeenCalledWith({
      caseId: "case-1",
      action: "confirm",
      reason: "정책 TALK-4.2 위반을 직접 확인했습니다.",
      expectedVersion: 3,
    }));
    expect(await screen.findByText(/correlationId: corr-123/)).toBeInTheDocument();
  });

  it("makes permanent suspension a two-person human review request, never an immediate action", async () => {
    render(<CaseDetailContent caseId="case-1" />);
    await screen.findByText("마스킹된 증거");
    expect(screen.getByText(/서로 다른 사람의 승인 2건/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/영구 정지 검토 요청/));
    expect(screen.getByRole("button", { name: "영구 정지 검토 요청 제출" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^영구 정지$/ })).not.toBeInTheDocument();
  });

  it("blocks actions until the verified actor owns the assignment", async () => {
    fetchCaseDetail.mockResolvedValue({ ok: true, data: { ...detail, assignedToUid: "mod-2" } });
    render(<CaseDetailContent caseId="case-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("내게 할당");
    expect(screen.getByRole("button", { name: "AI 판단 확인 제출" })).toBeDisabled();
  });

  it("shows safe not-found and network error states", async () => {
    fetchCaseDetail.mockResolvedValue({ ok: false, error: "not-found" });
    render(<CaseDetailContent caseId="missing" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("찾을 수 없습니다");
    expect(screen.queryByText("마스킹된 증거")).not.toBeInTheDocument();
  });
});

