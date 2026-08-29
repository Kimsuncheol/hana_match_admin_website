"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/nav/admin-nav";
import { CaseActionPanel } from "@/components/moderation/case-action-panel";
import {
  AiReviewPanel,
  CaseSummary,
  EvidencePanel,
  UserHistoryPanel,
} from "@/components/moderation/case-detail-panels";
import { useAuth } from "@/lib/firebase/auth-context";
import { fetchCaseDetail, submitModerationAction, type DetailClientError } from "@/lib/moderation/detail-client";
import type { CaseDetailDto, ModerationActionInput, ModerationActionResult } from "@/lib/moderation/detail-types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: DetailClientError }
  | { status: "ready"; data: CaseDetailDto };

const ERROR_MESSAGES: Record<DetailClientError, string> = {
  unauthenticated: "세션이 만료되었습니다. 다시 로그인해주세요.",
  forbidden: "이 케이스를 볼 수 있는 권한이 없습니다.",
  "not-found": "케이스를 찾을 수 없습니다.",
  conflict: "다른 검토자가 케이스를 변경했습니다. 최신 상태를 다시 불러오세요.",
  network: "케이스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
};

function DetailSkeleton() {
  return (
    <div role="status" aria-label="케이스 상세 불러오는 중" className="mt-6 space-y-4">
      <span className="sr-only">불러오는 중...</span>
      {[220, 300, 150].map((height) => (
        <div key={height} className="animate-pulse rounded-xl border border-zinc-200 bg-white" style={{ height }} />
      ))}
    </div>
  );
}

export function CaseDetailContent({ caseId }: { caseId: string }) {
  const { user, role, signOut } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ModerationActionResult | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchCaseDetail(user, caseId).then((result) => {
      if (!active) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
    });
    return () => {
      active = false;
    };
  }, [user, caseId, requestVersion]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setRequestVersion((version) => version + 1);
  }, []);

  async function submit(input: ModerationActionInput) {
    setSubmitting(true);
    setActionError(null);
    setReceipt(null);
    const result = await submitModerationAction(input);
    setSubmitting(false);
    if (!result.ok) {
      setActionError(ERROR_MESSAGES[result.error]);
      return;
    }
    setReceipt(result.data);
    setRequestVersion((version) => version + 1);
  }

  if (!user || !role) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminNav role={role} email={user.email} onSignOut={() => void signOut()} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Link href="/moderation" className="text-sm font-medium text-emerald-800 hover:underline">← 모더레이션 큐</Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-700">Case review</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900">케이스 상세 검토</h1>
          </div>
          {state.status === "ready" ? <CaseSummary detail={state.data} /> : null}
        </div>

        {state.status === "loading" ? <DetailSkeleton /> : null}

        {state.status === "error" ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-800">{ERROR_MESSAGES[state.error]}</p>
            {state.error === "network" || state.error === "conflict" ? (
              <button onClick={reload} className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100">
                다시 불러오기
              </button>
            ) : null}
          </div>
        ) : null}

        {state.status === "ready" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <EvidencePanel detail={state.data} />
              <AiReviewPanel detail={state.data} />
              <UserHistoryPanel detail={state.data} />
            </div>
            <div>
              {receipt ? (
                <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">조치가 감사 로그에 기록되었습니다.</p>
                  <p className="mt-1 break-all font-mono text-xs">correlationId: {receipt.correlationId}</p>
                  {receipt.humanReviewRequired ? <p className="mt-2">영구 정지는 적용되지 않았으며 2인 승인 검토로 전달되었습니다.</p> : null}
                </div>
              ) : null}
              {actionError ? <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{actionError}</div> : null}
              <CaseActionPanel
                detail={state.data}
                disabled={state.data.assignedToUid !== user.uid}
                submitting={submitting}
                onSubmit={(input) => void submit(input)}
              />
              {state.data.permanentSuspensionReview ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  <p className="font-semibold">영구 정지 사람 검토 대기 중</p>
                  <p className="mt-1">필요 승인: {state.data.permanentSuspensionReview.requiredApprovals}명. 승인 전에는 계정이 영구 정지되지 않습니다.</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

