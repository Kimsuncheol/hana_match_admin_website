import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolicySettingsContent } from "./policy-settings-content";

const useAuthMock = vi.fn();
vi.mock("@/lib/firebase/auth-context", () => ({ useAuth: () => useAuthMock() }));
const fetchPolicySettings = vi.fn();
const mutatePolicySettings = vi.fn();
vi.mock("@/lib/policy-settings/client", () => ({
  fetchPolicySettings: (...args: unknown[]) => fetchPolicySettings(...args),
  mutatePolicySettings: (...args: unknown[]) => mutatePolicySettings(...args),
}));

const config = {
  moderationThresholds: { autoHideConfidence: 0.96, escalationConfidence: 0.82, criticalRiskScore: 85 },
  ruleVersions: { harassment: "harassment-v1", spam: "spam-v1", safety: "safety-v1" },
  reversibleActionExpiryHours: { hiddenContent: 72, talkRateLimit: 24, warning: 168 },
  talkRateLimits: { messagesPerMinute: 20, burst: 8, restrictionMinutes: 60 },
  escalationRoutes: [{ severity: "critical", destination: "on-call", slaMinutes: 15, enabled: true }],
  featureFlags: { aiSuggestions: true, automatedHiding: false, talkRateLimiting: true, enhancedAudit: true },
  rollout: { mode: "shadow", percentage: 0 },
};
const response = { current: { version: 3, versionId: "version-3", config, updatedAt: "2026-08-29T00:00:00Z" }, versions: [{ versionId: "version-2", version: 2, reason: "이전 안정 버전 게시", operation: "publish", createdAt: "2026-08-28T00:00:00Z", rollbackTargetId: "version-1" }] };

describe("PolicySettingsContent", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { uid: "root", email: "root@example.com" }, role: "superAdmin", signOut: vi.fn() });
    fetchPolicySettings.mockReset().mockResolvedValue({ ok: true, data: response });
    mutatePolicySettings.mockReset().mockResolvedValue({ ok: true, data: { ok: true, correlationId: "corr-policy", version: 4, versionId: "version-4", rollbackTargetId: "version-3" } });
  });

  it("loads settings only through the callable client and renders version history", async () => {
    render(<PolicySettingsContent />);
    expect(screen.getByRole("status", { name: "정책 설정 불러오는 중" })).toBeInTheDocument();
    expect(await screen.findByText("현재 버전")).toBeInTheDocument();
    expect(fetchPolicySettings).toHaveBeenCalledTimes(1);
    expect(screen.getByText("이전 안정 버전 게시")).toBeInTheDocument();
  });

  it("requires validation and explicit confirmation before a publish mutation", async () => {
    render(<PolicySettingsContent />);
    await screen.findByText("현재 버전");
    fireEvent.click(screen.getByRole("button", { name: "변경 검토" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("변경 사유는 10~500자로 입력하세요");
    expect(mutatePolicySettings).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("필수 변경 사유"), { target: { value: "운영 검토 결과에 따라 정책을 게시합니다." } });
    fireEvent.click(screen.getByRole("button", { name: "변경 검토" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인 및 실행" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/새 불변 버전과 감사 로그/));
    fireEvent.click(screen.getByRole("button", { name: "확인 및 실행" }));
    await waitFor(() => expect(mutatePolicySettings).toHaveBeenCalledWith(expect.objectContaining({ operation: "publish", expectedVersion: 3 })));
  });

  it("surfaces denied callable reads without rendering settings", async () => {
    fetchPolicySettings.mockResolvedValue({ ok: false, error: "forbidden" });
    render(<PolicySettingsContent />);
    expect(await screen.findByRole("alert")).toHaveTextContent("superAdmin 권한이 필요합니다");
    expect(screen.queryByText("모더레이션 임계값")).not.toBeInTheDocument();
  });
});
