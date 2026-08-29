"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import type { AdminRole } from "@/lib/firebase/claims";

const ANY_ADMIN_ROLE: readonly AdminRole[] = ["admin", "moderator"];

type Props = {
  children: React.ReactNode;
  /** Roles allowed to view this route. Defaults to any admin-console role (admin or moderator). */
  allowedRoles?: readonly AdminRole[];
};

/**
 * Gates admin-only routes. Client-side gating is UX only — the real
 * enforcement is each API route re-deriving the role from the verified ID
 * token (see lib/firebase-admin/authorize.ts), since that claim can only
 * be set server-side (see lib/firebase-admin/assign-role.ts). This
 * component just avoids flashing gated content and gives a clear
 * "access denied" state; a role check here can never grant real access.
 */
export function ProtectedRoute({ children, allowedRoles = ANY_ADMIN_ROLE }: Props) {
  const { user, role, loading, refreshClaims } = useAuth();
  const router = useRouter();
  const [checkingClaims, setCheckingClaims] = useState(true);
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    if (hasRefreshed.current) return;
    hasRefreshed.current = true;

    // Pick up a claim granted after the user's current session started
    // (e.g. the role-assignment call finished a moment after sign-up)
    // without forcing a full re-login.
    refreshClaims().finally(() => setCheckingClaims(false));
  }, [loading, user, refreshClaims]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/sign-in");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return null;
  }

  if (checkingClaims) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        확인 중...
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-800">접근이 거부되었습니다</h1>
        <p className="mt-2 text-sm text-red-700">
          이 계정에는 이 페이지에 대한 권한이 없습니다. 관리자에게 문의하세요.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
