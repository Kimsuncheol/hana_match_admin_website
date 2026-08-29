"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";

type Props = {
  children: React.ReactNode;
};

/**
 * Gates admin-only routes. Client-side gating is UX only — the real
 * enforcement is Firestore/Storage security rules checking
 * request.auth.token.admin, since that claim can only be set server-side
 * (see functions/src/adminAssignment.ts). This component just avoids
 * flashing gated content and gives a clear "access denied" state.
 */
export function ProtectedRoute({ children }: Props) {
  const { user, isAdmin, loading, refreshClaims } = useAuth();
  const router = useRouter();
  const [checkingClaims, setCheckingClaims] = useState(true);
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    if (hasRefreshed.current) return;
    hasRefreshed.current = true;

    // Pick up a claim granted after the user's current session started
    // (e.g. the Cloud Function finished a moment after sign-up) without
    // forcing a full re-login.
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

  if (!isAdmin) {
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-800">접근이 거부되었습니다</h1>
        <p className="mt-2 text-sm text-red-700">
          이 계정에는 관리자 권한이 없습니다. 관리자에게 문의하세요.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
