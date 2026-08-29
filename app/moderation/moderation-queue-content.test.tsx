import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModerationQueueContent } from "./moderation-queue-content";

const useAuthMock = vi.fn();
vi.mock("@/lib/firebase/auth-context", () => ({ useAuth: () => useAuthMock() }));

const fetchModerationQueue = vi.fn();
const changeCaseAssignment = vi.fn();
vi.mock("@/lib/moderation/client", () => ({
  fetchModerationQueue: (...args: unknown[]) => fetchModerationQueue(...args),
  changeCaseAssignment: (...args: unknown[]) => changeCaseAssignment(...args),
}));

const user = { uid: "mod-1", email: "mod@example.com" };
const queueData = {
  items: [
    {
      id: "case-1",
      priority: "high",
      language: "ko",
      targetType: "message",
      summary: "괴롭힘 신고 메시지",
      assignedToUid: null,
      assignedToLabel: null,
      slaState: "at_risk",
      slaDueAt: "2026-08-30T00:00:00.000Z",
      aiContext: { labels: ["harassment"], confidence: 0.87 },
    },
  ],
  pageInfo: { nextCursor: "next-page" },
};

describe("ModerationQueueContent", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user, role: "moderator", signOut: vi.fn() });
    fetchModerationQueue.mockReset().mockResolvedValue({ ok: true, data: queueData });
    changeCaseAssignment.mockReset().mockResolvedValue({ ok: true });
  });

  it("renders accessible filters, AI context, responsive case views, and detail links", async () => {
    render(<ModerationQueueContent />);
    expect(screen.getByRole("status", { name: "모더레이션 큐 불러오는 중" })).toBeInTheDocument();

    expect(await screen.findAllByText("괴롭힘 신고 메시지")).toHaveLength(2);
    expect(screen.getByRole("form", { name: "모더레이션 케이스 필터" })).toBeInTheDocument();
    expect(screen.getByLabelText("우선순위")).toBeInTheDocument();
    expect(screen.getByLabelText("언어")).toBeInTheDocument();
    expect(screen.getAllByText("AI 참고 · 최종 판단 아님")).toHaveLength(2);
    expect(screen.getAllByText(/harassment · 87%/)).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: /괴롭힘 신고 메시지|상세 검토/ })) {
      expect(link).toHaveAttribute("href", "/moderation/cases/case-1");
    }
  });

  it("applies filters and paginates through server cursors", async () => {
    render(<ModerationQueueContent />);
    await screen.findAllByText("괴롭힘 신고 메시지");

    fireEvent.change(screen.getByLabelText("우선순위"), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "필터 적용" }));
    await waitFor(() => expect(fetchModerationQueue).toHaveBeenLastCalledWith(user, expect.objectContaining({ priority: "high" })));

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(fetchModerationQueue).toHaveBeenLastCalledWith(user, expect.objectContaining({ cursor: "next-page" })));
  });

  it("assigns only through the dedicated assignment client", async () => {
    render(<ModerationQueueContent />);
    await screen.findAllByText("괴롭힘 신고 메시지");
    fireEvent.click(screen.getAllByRole("button", { name: "case-1 내게 할당" })[0]);
    await waitFor(() => expect(changeCaseAssignment).toHaveBeenCalledWith(user, "case-1", "assign_to_me"));
  });

  it("shows empty and retryable error states", async () => {
    fetchModerationQueue.mockResolvedValueOnce({ ok: false, error: "network" });
    render(<ModerationQueueContent />);
    expect(await screen.findByRole("alert")).toHaveTextContent("불러오지 못했습니다");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});

