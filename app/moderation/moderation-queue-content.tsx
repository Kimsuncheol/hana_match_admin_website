"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/nav/admin-nav";
import { QueueFilters } from "@/components/moderation/queue-filters";
import { QueueList } from "@/components/moderation/queue-list";
import { QueueSkeleton } from "@/components/moderation/queue-skeleton";
import { changeCaseAssignment, fetchModerationQueue, type QueueClientError } from "@/lib/moderation/client";
import {
  DEFAULT_QUEUE_FILTERS,
  type ModerationQueueCase,
  type ModerationQueueFilters,
  type ModerationQueueResponse,
} from "@/lib/moderation/types";
import { useAuth } from "@/lib/firebase/auth-context";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: QueueClientError }
  | { status: "ready"; data: ModerationQueueResponse };

const ERROR_MESSAGES: Record<QueueClientError, string> = {
  unauthenticated: "세션이 만료되었습니다. 다시 로그인해주세요.",
  forbidden: "모더레이션 큐를 볼 수 있는 권한이 없습니다.",
  "invalid-query": "필터 값이 올바르지 않습니다. 필터를 초기화하고 다시 시도해주세요.",
  network: "모더레이션 큐를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
};

export function ModerationQueueContent() {
  const { user, role, signOut } = useAuth();
  const [draftFilters, setDraftFilters] = useState<ModerationQueueFilters>({ ...DEFAULT_QUEUE_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<ModerationQueueFilters>({ ...DEFAULT_QUEUE_FILTERS });
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentCursor = cursorHistory[cursorHistory.length - 1];

  useEffect(() => {
    if (!user) return;
    let active = true;
    const filters = { ...appliedFilters, cursor: currentCursor };

    fetchModerationQueue(user, filters).then((result) => {
      if (!active) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
    });

    return () => {
      active = false;
    };
  }, [user, appliedFilters, currentCursor, requestVersion]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setRequestVersion((version) => version + 1);
  }, []);

  function applyFilters() {
    setCursorHistory([undefined]);
    setAppliedFilters({ ...draftFilters, cursor: undefined });
    setState({ status: "loading" });
  }

  function resetFilters() {
    const defaults = { ...DEFAULT_QUEUE_FILTERS };
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setCursorHistory([undefined]);
    setState({ status: "loading" });
  }

  function nextPage(cursor: string) {
    setCursorHistory((history) => [...history, cursor]);
    setState({ status: "loading" });
  }

  function previousPage() {
    setCursorHistory((history) => history.slice(0, -1));
    setState({ status: "loading" });
  }

  async function changeAssignment(item: ModerationQueueCase, action: "assign_to_me" | "release") {
    if (!user) return;
    setPendingCaseId(item.id);
    setActionError(null);
    const result = await changeCaseAssignment(user, item.id, action);
    setPendingCaseId(null);
    if (!result.ok) {
      setActionError(
        result.error === "conflict"
          ? "다른 검토자가 먼저 이 케이스를 할당했거나 상태가 변경되었습니다."
          : "담당자 변경에 실패했습니다. 다시 시도해주세요.",
      );
      return;
    }
    reload();
  }

  if (!user || !role) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminNav role={role} email={user.email} onSignOut={() => void signOut()} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div>
          <p className="text-sm font-medium text-emerald-700">Trust &amp; Safety</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">모더레이션 큐</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            AI 라벨과 신뢰도는 검토 문맥일 뿐이며, 최종 조치의 근거로 단독 사용하지 않습니다.
          </p>
        </div>

        <div className="mt-6">
          <QueueFilters
            value={draftFilters}
            disabled={state.status === "loading"}
            onChange={setDraftFilters}
            onApply={applyFilters}
            onReset={resetFilters}
          />
        </div>

        {actionError ? (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {actionError}
          </div>
        ) : null}

        <section aria-labelledby="cases-heading" className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="cases-heading" className="text-lg font-semibold text-zinc-900">검토 대기 케이스</h2>
            <span className="text-sm text-zinc-500">페이지 {cursorHistory.length}</span>
          </div>

          {state.status === "loading" ? <QueueSkeleton /> : null}

          {state.status === "error" ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-sm text-red-800">{ERROR_MESSAGES[state.error]}</p>
              {state.error === "network" ? (
                <button onClick={reload} className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100">
                  다시 시도
                </button>
              ) : null}
            </div>
          ) : null}

          {state.status === "ready" ? (
            <>
              <QueueList
                items={state.data.items}
                actorUid={user.uid}
                pendingCaseId={pendingCaseId}
                onAssignment={(item, action) => void changeAssignment(item, action)}
              />
              <nav aria-label="케이스 페이지" className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={previousPage}
                  disabled={cursorHistory.length === 1}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => state.data.pageInfo.nextCursor && nextPage(state.data.pageInfo.nextCursor)}
                  disabled={!state.data.pageInfo.nextCursor}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40"
                >
                  다음
                </button>
              </nav>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}

