import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProtectedRoute } from "./protected-route";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const useAuthMock = vi.fn();
vi.mock("@/lib/firebase/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    replace.mockClear();
    useAuthMock.mockReset();
  });

  it("redirects unauthenticated users to sign-in and renders nothing", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      role: null,
      loading: false,
      refreshClaims: vi.fn(),
    });

    const { container } = render(
      <ProtectedRoute>
        <div>secret dashboard</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("secret dashboard")).not.toBeInTheDocument();
  });

  it("shows an access-denied message for a signed-in user with no admin-console role, without rendering gated content", async () => {
    const refreshClaims = vi.fn().mockResolvedValue({ admin: false });
    useAuthMock.mockReturnValue({
      user: { uid: "u1", email: "random@gmail.com" },
      role: null,
      loading: false,
      refreshClaims,
    });

    render(
      <ProtectedRoute>
        <div>secret dashboard</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(refreshClaims).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("접근이 거부되었습니다");
    expect(screen.queryByText("secret dashboard")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders gated content for an admin user after refreshing claims", async () => {
    const refreshClaims = vi.fn().mockResolvedValue({ admin: true, role: "admin" });
    useAuthMock.mockReturnValue({
      user: { uid: "u1", email: "staff@hanamatch.com" },
      role: "admin",
      loading: false,
      refreshClaims,
    });

    render(
      <ProtectedRoute>
        <div>secret dashboard</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(refreshClaims).toHaveBeenCalled());
    expect(await screen.findByText("secret dashboard")).toBeInTheDocument();
  });

  it("denies a moderator on a route scoped to allowedRoles=['admin'] only", async () => {
    const refreshClaims = vi.fn().mockResolvedValue({ admin: true, role: "moderator" });
    useAuthMock.mockReturnValue({
      user: { uid: "u2", email: "mod@hanamatch.com" },
      role: "moderator",
      loading: false,
      refreshClaims,
    });

    render(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>admin-only section</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(refreshClaims).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("접근이 거부되었습니다");
    expect(screen.queryByText("admin-only section")).not.toBeInTheDocument();
  });

  it("allows a moderator on a route scoped to allowedRoles=['admin', 'moderator']", async () => {
    const refreshClaims = vi.fn().mockResolvedValue({ admin: true, role: "moderator" });
    useAuthMock.mockReturnValue({
      user: { uid: "u2", email: "mod@hanamatch.com" },
      role: "moderator",
      loading: false,
      refreshClaims,
    });

    render(
      <ProtectedRoute allowedRoles={["admin", "moderator"]}>
        <div>shared section</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(refreshClaims).toHaveBeenCalled());
    expect(await screen.findByText("shared section")).toBeInTheDocument();
  });
});
