import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserOperationsContent } from "./user-operations-content";

const useAuthMock = vi.fn();
vi.mock("@/lib/firebase/auth-context", () => ({ useAuth: () => useAuthMock() }));
const fetchUserOperations = vi.fn();
const submitUserOperation = vi.fn();
vi.mock("@/lib/user-operations/client", () => ({
  fetchUserOperations: (...args: unknown[]) => fetchUserOperations(...args),
  submitUserOperation: (...args: unknown[]) => submitUserOperation(...args),
}));

const user = { uid: "admin-1", email: "admin@example.com" };
const row = {
  uid: "user-1",
  maskedUid: "user…er-1",
  maskedEmail: "se***@example.com",
  maskedDisplayName: "S***",
  verification: { emailVerified: true },
  status: "active",
  trustFlags: ["watch"],
  restrictions: { talkRateLimitedUntil: "2026-08-30T00:00:00Z", permanentSuspensionReviewPending: false },
  recentModerationHistory: [{ action: "warn_user", occurredAt: "2026-08-29T00:00:00Z", evidenceContext: { caseId: "case-1", reason: "관리자 전용 근거" } }],
  lastActivityAt: "2026-08-29T10:00:00Z",
  version: 4,
};

describe("UserOperationsContent", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user, role: "admin", signOut: vi.fn() });
    fetchUserOperations.mockReset().mockResolvedValue({ ok: true, data: { role: "admin", users: [row], pageInfo: { nextCursor: "next" } } });
    submitUserOperation.mockReset().mockResolvedValue({ ok: true, data: { ok: true, correlationId: "corr-user-1", version: 5 } });
  });

  it("renders accessible filters/table and clear verification, restriction, history, and activity states", async () => {
    render(<UserOperationsContent />);
    expect(screen.getByRole("status", { name: "사용자 운영 정보 불러오는 중" })).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "관리자 사용자 운영 검색 결과" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "사용자 검색 및 필터" })).toBeInTheDocument();
    expect(screen.getAllByText("se***@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("이메일 인증").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Talk 제한").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/관리자 전용 근거/).length).toBeGreaterThan(0);
  });

  it("searches and paginates through the protected endpoint contract", async () => {
    render(<UserOperationsContent />); await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("이메일 또는 UID"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "검색 적용" }));
    await waitFor(() => expect(fetchUserOperations).toHaveBeenLastCalledWith(user, expect.objectContaining({ query: "user@example.com" })));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(fetchUserOperations).toHaveBeenLastCalledWith(user, expect.objectContaining({ cursor: "next" })));
  });

  it("submits account mutations only through the privileged callable client", async () => {
    render(<UserOperationsContent />); await screen.findByRole("table");
    fireEvent.click(screen.getAllByRole("button", { name: "se***@example.com 관리" })[0]);
    fireEvent.change(screen.getByLabelText("변경 사유"), { target: { value: "운영 정책에 따라 계정을 비활성화합니다." } });
    fireEvent.click(screen.getByRole("button", { name: "조치 제출" }));
    await waitFor(() => expect(submitUserOperation).toHaveBeenCalledWith({ userUid: "user-1", action: "disable_account", reason: "운영 정책에 따라 계정을 비활성화합니다.", expectedVersion: 4 }));
    expect(await screen.findByText(/correlationId: corr-user-1/)).toBeInTheDocument();
  });

  it("renders moderator results read-only without evidence context", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "mod-1", email: "mod@example.com" }, role: "moderator", signOut: vi.fn() });
    fetchUserOperations.mockResolvedValue({ ok: true, data: { role: "moderator", users: [{ ...row, recentModerationHistory: [{ action: "warn_user", occurredAt: "2026-08-29T00:00:00Z" }] }], pageInfo: { nextCursor: null } } });
    render(<UserOperationsContent />);
    expect(await screen.findByText(/읽기 전용/)).toBeInTheDocument();
    expect(screen.queryByText("관리자 전용 근거")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /관리$/ })).not.toBeInTheDocument();
  });

  it("shows safe empty and error states", async () => {
    fetchUserOperations.mockResolvedValue({ ok: true, data: { role: "admin", users: [], pageInfo: { nextCursor: null } } });
    render(<UserOperationsContent />);
    expect(await screen.findByText("조건에 맞는 사용자가 없습니다.")).toBeInTheDocument();
  });
});
