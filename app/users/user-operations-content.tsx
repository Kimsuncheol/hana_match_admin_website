"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/nav/admin-nav";
import { UserFilters } from "@/components/user-operations/user-filters";
import { UserOperationPanel } from "@/components/user-operations/user-operation-panel";
import { UserTable } from "@/components/user-operations/user-table";
import { useAuth } from "@/lib/firebase/auth-context";
import { fetchUserOperations, submitUserOperation, type UserOperationsError } from "@/lib/user-operations/client";
import {
  DEFAULT_USER_FILTERS,
  type UserOperationInput,
  type UserOperationsFilters,
  type UserOperationsResponse,
  type UserOperationsRow,
} from "@/lib/user-operations/types";

type State = { status: "loading" } | { status: "error"; error: UserOperationsError } | { status: "ready"; data: UserOperationsResponse };
const ERRORS: Record<UserOperationsError, string> = {
  unauthenticated: "세션이 만료되었습니다. 다시 로그인해주세요.",
  forbidden: "사용자 운영 정보에 접근할 권한이 없습니다.",
  "invalid-query": "검색어 또는 필터가 올바르지 않습니다.",
  conflict: "사용자 상태가 변경되었습니다. 최신 정보를 다시 불러오세요.",
  network: "사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
};

function LoadingState() {
  return <div role="status" aria-label="사용자 운영 정보 불러오는 중" className="rounded-xl border border-zinc-200 bg-white p-4"><span className="sr-only">불러오는 중...</span>{Array.from({ length: 6 }, (_, index) => <div key={index} className="mb-3 h-14 animate-pulse rounded bg-zinc-100 last:mb-0" />)}</div>;
}

export function UserOperationsContent() {
  const { user, role, signOut } = useAuth();
  const [draft, setDraft] = useState<UserOperationsFilters>({ ...DEFAULT_USER_FILTERS });
  const [applied, setApplied] = useState<UserOperationsFilters>({ ...DEFAULT_USER_FILTERS });
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [state, setState] = useState<State>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);
  const [selected, setSelected] = useState<UserOperationsRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [operationMessage, setOperationMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const cursor = cursors[cursors.length - 1];

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchUserOperations(user, { ...applied, cursor }).then((result) => {
      if (!active) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
    });
    return () => { active = false; };
  }, [user, applied, cursor, requestVersion]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setRequestVersion((value) => value + 1);
  }, []);

  function applyFilters() {
    setApplied({ ...draft, cursor: undefined });
    setCursors([undefined]);
    setSelected(null);
    setState({ status: "loading" });
  }
  function resetFilters() {
    const defaults = { ...DEFAULT_USER_FILTERS };
    setDraft(defaults); setApplied(defaults); setCursors([undefined]); setSelected(null); setState({ status: "loading" });
  }
  async function operate(input: UserOperationInput) {
    setSubmitting(true); setOperationMessage(null);
    const result = await submitUserOperation(input);
    setSubmitting(false);
    if (!result.ok) {
      setOperationMessage({ kind: "error", text: ERRORS[result.error] });
      return;
    }
    setOperationMessage({ kind: "success", text: `조치가 기록되었습니다. correlationId: ${result.data.correlationId}` });
    setSelected(null);
    reload();
  }

  if (!user || !role) return null;
  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminNav role={role} email={user.email} onSignOut={() => void signOut()} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-sm font-medium text-emerald-700">User operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">사용자 운영</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">민감한 신원 정보는 마스킹되며, 계정 변경은 감사 가능한 privileged Cloud Function을 통해서만 수행됩니다.</p>
        <div className="mt-6"><UserFilters value={draft} disabled={state.status === "loading"} onChange={setDraft} onApply={applyFilters} onReset={resetFilters} /></div>

        {operationMessage ? <div role={operationMessage.kind === "error" ? "alert" : "status"} className={`mt-4 rounded-lg border p-3 text-sm ${operationMessage.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{operationMessage.text}</div> : null}
        {selected ? <UserOperationPanel user={selected} submitting={submitting} onClose={() => setSelected(null)} onSubmit={(input) => void operate(input)} /> : null}

        <section aria-labelledby="users-heading" className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h2 id="users-heading" className="text-lg font-semibold text-zinc-900">검색 결과</h2><span className="text-sm text-zinc-500">페이지 {cursors.length}</span></div>
          {state.status === "loading" ? <LoadingState /> : null}
          {state.status === "error" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-8 text-center"><p className="text-sm text-red-800">{ERRORS[state.error]}</p>{state.error === "network" || state.error === "conflict" ? <button type="button" onClick={reload} className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800">다시 시도</button> : null}</div> : null}
          {state.status === "ready" ? <>
            {state.data.role === "moderator" ? <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">모더레이터에게는 상세 사유와 케이스 증거 문맥이 숨겨지며 사용자 정보는 읽기 전용입니다.</p> : null}
            <UserTable users={state.data.users} canMutate={state.data.role === "admin"} onManage={setSelected} />
            <nav aria-label="사용자 결과 페이지" className="mt-4 flex justify-between"><button type="button" disabled={cursors.length === 1} onClick={() => { setCursors((value) => value.slice(0, -1)); setState({ status: "loading" }); }} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40">이전</button><button type="button" disabled={!state.data.pageInfo.nextCursor} onClick={() => { if (state.data.pageInfo.nextCursor) setCursors((value) => [...value, state.data.pageInfo.nextCursor ?? undefined]); setState({ status: "loading" }); }} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40">다음</button></nav>
          </> : null}
        </section>
      </main>
    </div>
  );
}

