"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/nav/admin-nav";
import { AgreementChart } from "@/components/model-health/agreement-chart";
import { HealthSummary } from "@/components/model-health/health-summary";
import { RolloutControl } from "@/components/model-health/rollout-control";
import { useAuth } from "@/lib/firebase/auth-context";
import { changeModelRollout, fetchModelHealth, type ModelHealthError } from "@/lib/model-health/client";
import type { ModelHealthPayload, RolloutModeChangeInput } from "@/lib/model-health/types";

type State = { status: "loading" } | { status: "error"; error: ModelHealthError } | { status: "ready"; data: ModelHealthPayload };
const ERRORS: Record<ModelHealthError, string> = { unauthenticated: "세션이 만료되었습니다. 다시 로그인하세요.", forbidden: "모델 상태를 볼 수 있는 관리자 권한이 없습니다.", invalid: "롤아웃 모드, 비율 또는 변경 사유를 확인하세요.", conflict: "배포 상태가 변경되었습니다. 최신 상태를 다시 불러오세요.", network: "모델 상태 집계를 불러오지 못했습니다. 잠시 후 다시 시도하세요." };

function LoadingState() {
  return <div role="status" aria-label="모델 상태 불러오는 중" className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-xl border border-zinc-200 bg-white" />)}</div><div className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-white" /><span className="sr-only">불러오는 중...</span></div>;
}

export function ModelHealthContent() {
  const { user, role, signOut } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    fetchModelHealth(user).then((result) => setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error }));
  }, [user]);
  useEffect(() => { load(); }, [load]);

  function retry() { setState({ status: "loading" }); setMessage(null); load(); }
  async function updateRollout(input: RolloutModeChangeInput) {
    setSubmitting(true); setMessage(null);
    const result = await changeModelRollout(input);
    setSubmitting(false);
    if (!result.ok) { setMessage({ kind: "error", text: ERRORS[result.error] }); if (result.error === "conflict") retry(); return; }
    setMessage({ kind: "success", text: `롤아웃 모드가 변경되었습니다. correlationId: ${result.data.correlationId}` });
    setState({ status: "loading" }); load();
  }

  if (!user || (role !== "admin" && role !== "superAdmin")) return null;
  return <div className="min-h-screen bg-zinc-50"><AdminNav role={role} email={user.email} onSignOut={() => void signOut()} /><main className="mx-auto max-w-7xl px-4 py-8">
    <p className="text-sm font-medium text-violet-700">Multilingual moderation · aggregate only</p><h1 className="mt-1 text-2xl font-semibold text-zinc-950">AI 모델 상태</h1><p className="mt-2 max-w-3xl text-sm text-zinc-600">실제 인간 검토 및 추론 쿼리의 집계만 표시합니다. 프롬프트, 모델 설정, 제공자 응답과 같은 원시 내부 정보는 이 응답에 포함되지 않습니다.</p>
    {message ? <div role={message.kind === "error" ? "alert" : "status"} className={`mt-5 rounded-lg border p-3 text-sm ${message.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{message.text}</div> : null}
    <div className="mt-6">{state.status === "loading" ? <LoadingState /> : null}{state.status === "error" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-8 text-center"><p className="text-sm text-red-800">{ERRORS[state.error]}</p>{state.error === "network" ? <button type="button" onClick={retry} className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800">다시 시도</button> : null}</div> : null}</div>
    {state.status === "ready" ? <div className="space-y-6"><HealthSummary data={state.data} /><div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><AgreementChart values={state.data.agreement} /><RolloutControl key={state.data.deployment.stateVersion} deployment={state.data.deployment} role={role} submitting={submitting} onSubmit={(input) => void updateRollout(input)} /></div><p className="text-xs text-zinc-500">마지막 집계: {new Date(state.data.window.generatedAt).toLocaleString("ko-KR")} · 검토 {state.data.window.reviewsDays}일 / 추론 {state.data.window.inferenceHours}시간</p></div> : null}
  </main></div>;
}
