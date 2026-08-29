import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "./admin-nav";

describe("AdminNav", () => {
  it("shows the AI model health link for an admin", () => {
    render(<AdminNav role="admin" email="boss@hanamatch.com" onSignOut={vi.fn()} />);
    expect(screen.getAllByText("AI 모델 상태").length).toBeGreaterThan(0);
    expect(screen.getAllByText("모더레이션 큐").length).toBeGreaterThan(0);
  });

  it("hides the AI model health link for a moderator", () => {
    render(<AdminNav role="moderator" email="mod@hanamatch.com" onSignOut={vi.fn()} />);
    expect(screen.queryByText("AI 모델 상태")).not.toBeInTheDocument();
    expect(screen.getAllByText("모더레이션 큐").length).toBeGreaterThan(0);
  });

  it("shows policy settings only for a super admin", () => {
    const { rerender } = render(<AdminNav role="superAdmin" email="root@hanamatch.com" onSignOut={vi.fn()} />);
    expect(screen.getAllByText("정책 설정").length).toBeGreaterThan(0);
    rerender(<AdminNav role="admin" email="boss@hanamatch.com" onSignOut={vi.fn()} />);
    expect(screen.queryByText("정책 설정")).not.toBeInTheDocument();
  });

  it("calls onSignOut when the sign-out button is clicked", () => {
    const onSignOut = vi.fn();
    render(<AdminNav role="admin" email="boss@hanamatch.com" onSignOut={onSignOut} />);

    const [signOutButton] = screen.getAllByRole("button", { name: "로그아웃" });
    fireEvent.click(signOutButton);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
