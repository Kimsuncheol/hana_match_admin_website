import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelHealthContent } from "./model-health-content";

const useAuthMock = vi.fn();
vi.mock("@/lib/firebase/auth-context", () => ({ useAuth: () => useAuthMock() }));
const fetchModelHealth = vi.fn();
const changeModelRollout = vi.fn();
vi.mock("@/lib/model-health/client", () => ({
  fetchModelHealth: (...args: unknown[]) => fetchModelHealth(...args),
  changeModelRollout: (...args: unknown[]) => changeModelRollout(...args),
}));

const user = { uid: "admin", email: "admin@example.com", getIdToken: vi.fn() };
const payload = {
  role: "admin",
  window: { reviewsDays: 30, inferenceHours: 24, generatedAt: "2026-08-30T00:00:00Z" },
  agreement: [
    { language: "ko", agreementPct: 91.2, agreedReviews: 91, reviewCount: 100 },
    { language: "ja", agreementPct: 87.5, agreedReviews: 35, reviewCount: 40 },
    { language: "mixed", agreementPct: 75, agreedReviews: 15, reviewCount: 20 },
  ],
  medianLatencyMs: 420,
  overrideRatePct: 8.1,
  failures: 3,
  inferenceSamples: 250,
  reviewSamples: 160,
  deployment: { modelVersion: "mod-v8", rolloutMode: "shadow", rolloutPercentage: 0, rollbackTarget: "mod-v7", stateVersion: 5, updatedAt: "2026-08-29T00:00:00Z" },
};

describe("ModelHealthContent", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user, role: "admin", signOut: vi.fn() });
    fetchModelHealth.mockReset().mockResolvedValue({ ok: true, data: payload });
    changeModelRollout.mockReset().mockResolvedValue({ ok: true, data: { ok: true, correlationId: "corr-rollout", stateVersion: 6, rolloutMode: "percentage", rolloutPercentage: 20, rollbackTarget: "mod-v7" } });
  });

  it("renders loading then real aggregate metrics and an accessible chart/table", async () => {
    render(<ModelHealthContent />);
    expect(screen.getByRole("status", { name: "모델 상태 불러오는 중" })).toBeInTheDocument();
    expect(await screen.findByText("420ms")).toBeInTheDocument();
    expect(screen.getByText("8.1%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /한국어 91.2%/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "언어별 인간 검토 일치율 데이터" })).toBeInTheDocument();
    expect(screen.getAllByText("mod-v8").length).toBeGreaterThan(0);
    expect(screen.getByText("mod-v7")).toBeInTheDocument();
  });

  it("keeps rollout controls read-only for an ordinary admin", async () => {
    render(<ModelHealthContent />);
    expect(await screen.findByText(/읽기 전용/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "변경 검토" })).not.toBeInTheDocument();
    expect(changeModelRollout).not.toHaveBeenCalled();
  });

  it("requires superAdmin confirmation and submits only the narrow rollout contract", async () => {
    useAuthMock.mockReturnValue({ user: { ...user, uid: "root" }, role: "superAdmin", signOut: vi.fn() });
    render(<ModelHealthContent />);
    await screen.findByText("420ms");
    fireEvent.change(screen.getByLabelText("새 배포 모드"), { target: { value: "percentage" } });
    fireEvent.change(screen.getByLabelText("배포 비율 (%)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("필수 변경 사유"), { target: { value: "한국어 및 일본어 카나리 검증을 시작합니다." } });
    fireEvent.click(screen.getByRole("button", { name: "변경 검토" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인 및 변경" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/운영 영향과 감사 기록/));
    fireEvent.click(screen.getByRole("button", { name: "확인 및 변경" }));
    await waitFor(() => expect(changeModelRollout).toHaveBeenCalledWith({ mode: "percentage", percentage: 20, expectedVersion: 5, reason: "한국어 및 일본어 카나리 검증을 시작합니다." }));
  });

  it("shows a safe forbidden state without aggregate content", async () => {
    fetchModelHealth.mockResolvedValue({ ok: false, error: "forbidden" });
    render(<ModelHealthContent />);
    expect(await screen.findByRole("alert")).toHaveTextContent("관리자 권한이 없습니다");
    expect(screen.queryByText("420ms")).not.toBeInTheDocument();
  });
});
