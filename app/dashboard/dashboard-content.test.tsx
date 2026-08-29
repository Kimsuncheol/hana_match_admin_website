import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DashboardContent } from "./dashboard-content";

const useAuthMock = vi.fn();
vi.mock("@/lib/firebase/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

const fetchDashboard = vi.fn();
vi.mock("@/lib/dashboard/client", () => ({
  fetchDashboard: (...args: unknown[]) => fetchDashboard(...args),
}));

function baseAuth(overrides: Partial<ReturnType<typeof useAuthMock>> = {}) {
  return {
    user: { uid: "u1", email: "boss@hanamatch.com" },
    role: "admin",
    signOut: vi.fn(),
    ...overrides,
  };
}

describe("DashboardContent", () => {
  beforeEach(() => {
    fetchDashboard.mockReset();
    useAuthMock.mockReset();
  });

  it("shows a loading skeleton, then renders admin metrics/queue/model health once data arrives", async () => {
    useAuthMock.mockReturnValue(baseAuth());
    fetchDashboard.mockResolvedValue({
      ok: true,
      data: {
        role: "admin",
        metrics: { openCases: 3, slaAtRisk: 1, slaBreached: 0, hiddenContent: 2, aiLatencyP95Ms: 420 },
        queue: [
          {
            id: "c1",
            status: "open",
            priority: "high",
            category: "message",
            summary: "reported for harassment",
            openedAt: "2026-08-29T00:00:00Z",
            slaDueAt: "2026-08-30T00:00:00Z",
            slaState: "ok",
          },
        ],
        modelHealth: [
          {
            model: "abuse-detector",
            p50Ms: 300,
            p95Ms: 500,
            errorRatePct: 0,
            sampleCount: 20,
            lastSeenAt: "2026-08-29T12:00:00Z",
            status: "healthy",
          },
        ],
      },
    });

    render(<DashboardContent />);

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);

    expect(await screen.findByText("3")).toBeInTheDocument(); // openCases
    expect(screen.getByText("420ms")).toBeInTheDocument();
    expect(screen.getByText("reported for harassment")).toBeInTheDocument();
    expect(screen.getByText("abuse-detector")).toBeInTheDocument();
  });

  it("hides SLA breach/risk, AI latency, and model health for a moderator", async () => {
    useAuthMock.mockReturnValue(baseAuth({ role: "moderator" }));
    fetchDashboard.mockResolvedValue({
      ok: true,
      data: {
        role: "moderator",
        metrics: { openCases: 2, hiddenContent: 1 },
        queue: [],
      },
    });

    render(<DashboardContent />);

    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.queryByText("SLA 위험")).not.toBeInTheDocument();
    expect(screen.queryByText("SLA 초과")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI 지연 시간/)).not.toBeInTheDocument();
    expect(screen.queryByText("AI 모델 상태")).not.toBeInTheDocument();
  });

  it("shows a forbidden message (not raw data, no crash) when the server rejects the request", async () => {
    useAuthMock.mockReturnValue(baseAuth());
    fetchDashboard.mockResolvedValue({ ok: false, error: { kind: "forbidden" } });

    render(<DashboardContent />);

    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다");
    expect(screen.queryByText("운영 대시보드")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a retryable network error state and refetches on retry", async () => {
    useAuthMock.mockReturnValue(baseAuth());
    fetchDashboard
      .mockResolvedValueOnce({ ok: false, error: { kind: "network" } })
      .mockResolvedValueOnce({
        ok: true,
        data: { role: "admin", metrics: { openCases: 0, slaAtRisk: 0, slaBreached: 0, hiddenContent: 0, aiLatencyP95Ms: null }, queue: [], modelHealth: [] },
      });

    render(<DashboardContent />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("다시 시도");
    const retryButton = screen.getByRole("button", { name: "다시 시도" });
    retryButton.click();

    await waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("처리할 케이스가 없습니다.")).toBeInTheDocument();
  });

  it("renders nothing while auth is still resolving the user", () => {
    useAuthMock.mockReturnValue(baseAuth({ user: null, role: null }));
    const { container } = render(<DashboardContent />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchDashboard).not.toHaveBeenCalled();
  });
});
