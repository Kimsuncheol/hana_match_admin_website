"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/nav/admin-nav";
import { PolicyEditor } from "@/components/policy-settings/policy-editor";
import { useAuth } from "@/lib/firebase/auth-context";
import { fetchPolicySettings, mutatePolicySettings, type PolicyClientError } from "@/lib/policy-settings/client";
import type { PolicyConfig, PolicyMutationInput, PolicySettingsResponse } from "@/lib/policy-settings/types";
import { validatePolicyDraft } from "@/lib/policy-settings/validation";

type LoadState = { status: "loading" } | { status: "error"; error: PolicyClientError } | { status: "ready"; data: PolicySettingsResponse };
const ERROR_MESSAGES: Record<PolicyClientError, string> = { unauthenticated: "세션이 만료되었습니다. 다시 로그인하세요.", forbidden: "superAdmin 권한이 필요합니다.", invalid: "정책 값 또는 변경 사유를 확인하세요.", conflict: "정책 버전이 변경되었거나 롤백 대상이 유효하지 않습니다. 다시 불러오세요.", network: "정책 설정을 불러오지 못했습니다. 잠시 후 다시 시도하세요." };

function LoadingState() {
  return <div role="status" aria-label="정책 설정 불러오는 중" className="grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-white" />)}<span className="sr-only">불러오는 중...</span></div>;
}

export function PolicySettingsContent() {
  const { user, role, signOut } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<PolicyConfig | null>(null);
  const [reason, setReason] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, setPending] = useState<PolicyMutationInput | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [rollbackTargetId, setRollbackTargetId] = useState("");

  const load = useCallback(() => {
    fetchPolicySettings().then((result) => {
      if (!result.ok) { setState({ status: "error", error: result.error }); return; }
      setState({ status: "ready", data: result.data });
      setDraft(structuredClone(result.data.current.config));
      setRollbackTargetId(result.data.versions.find((item) => item.versionId !== result.data.current.versionId)?.versionId ?? "");
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  function retry() { setState({ status: "loading" }); setMessage(null); load(); }
  function reviewPublish() {
    if (!draft || state.status !== "ready") return;
    const nextIssues = validatePolicyDraft(draft, reason);
    setIssues(nextIssues);
    if (nextIssues.length) return;
    setPending({ operation: "publish", expectedVersion: state.data.current.version, reason: reason.trim(), config: draft });
    setConfirmed(false);
  }
  function reviewRollback() {
    if (state.status !== "ready") return;
    const nextIssues = reason.trim().length < 10 || reason.trim().length > 500 ? ["롤백 사유는 10~500자로 입력하세요."] : [];
    if (!state.data.versions.some((item) => item.versionId === rollbackTargetId && item.versionId !== state.data.current.versionId)) nextIssues.push("유효한 이전 버전을 선택하세요.");
    setIssues(nextIssues);
    if (nextIssues.length) return;
    setPending({ operation: "rollback", expectedVersion: state.data.current.version, reason: reason.trim(), targetVersionId: rollbackTargetId });
    setConfirmed(false);
  }
  async function submit() {
    if (!pending || !confirmed) return;
    setSubmitting(true); setMessage(null);
    const result = await mutatePolicySettings(pending);
    setSubmitting(false);
    if (!result.ok) { setMessage({ kind: "error", text: ERROR_MESSAGES[result.error] }); if (result.error === "conflict") setPending(null); return; }
    setMessage({ kind: "success", text: `정책 v${result.data.version}이 생성되었습니다. correlationId: ${result.data.correlationId}` });
    setPending(null); setReason(""); setIssues([]); setConfirmed(false); setState({ status: "loading" }); load();
  }

  if (!user || role !== "superAdmin") return null;
  return <div className="min-h-screen bg-zinc-50">
    <AdminNav role={role} email={user.email} onSignOut={() => void signOut()} />
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-violet-700">Super admin · version controlled</p><h1 className="mt-1 text-2xl font-semibold text-zinc-900">정책 설정</h1><p className="mt-2 max-w-3xl text-sm text-zinc-600">모든 조회와 변경은 권한이 검증된 Firebase Cloud Function을 통하며, 게시된 버전과 감사 로그는 클라이언트에서 수정할 수 없습니다.</p></div>{state.status === "ready" ? <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm"><span className="text-zinc-500">현재 버전</span> <strong className="ml-2 text-zinc-900">v{state.data.current.version}</strong></div> : null}</div>
      {message ? <div role={message.kind === "error" ? "alert" : "status"} className={`mt-5 rounded-lg border p-3 text-sm ${message.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{message.text}</div> : null}
      <div className="mt-6">{state.status === "loading" ? <LoadingState /> : null}{state.status === "error" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-8 text-center"><p className="text-sm text-red-800">{ERROR_MESSAGES[state.error]}</p><button type="button" onClick={retry} className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800">다시 시도</button></div> : null}</div>
      {state.status === "ready" && draft ? <>
        <PolicyEditor value={draft} disabled={submitting || pending !== null} onChange={setDraft} />
        <section aria-labelledby="change-control-heading" className="mt-6 rounded-xl border border-zinc-200 bg-white p-5"><h2 id="change-control-heading" className="text-lg font-semibold text-zinc-900">변경 통제</h2><label className="mt-4 flex flex-col gap-1 text-sm font-medium text-zinc-700">필수 변경 사유<textarea value={reason} maxLength={500} disabled={submitting || pending !== null} onChange={(event) => setReason(event.target.value)} rows={3} className="rounded-md border border-zinc-300 px-3 py-2" placeholder="10자 이상의 운영상 사유를 입력하세요." /></label>
          {issues.length ? <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p className="font-medium">게시 전 다음 항목을 확인하세요.</p><ul className="mt-1 list-disc pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : null}
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end"><button type="button" disabled={submitting || pending !== null} onClick={reviewPublish} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">변경 검토</button><div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"><label className="flex flex-1 flex-col gap-1 text-sm text-zinc-700">롤백 대상<select aria-label="롤백 대상" value={rollbackTargetId} disabled={submitting || pending !== null || state.data.versions.length === 0} onChange={(event) => setRollbackTargetId(event.target.value)} className="rounded-md border border-zinc-300 bg-white px-3 py-2"><option value="">이전 버전 선택</option>{state.data.versions.filter((item) => item.versionId !== state.data.current.versionId).map((item) => <option key={item.versionId} value={item.versionId}>v{item.version} · {item.reason}</option>)}</select></label><button type="button" disabled={submitting || pending !== null || !rollbackTargetId} onClick={reviewRollback} className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-50">롤백 검토</button></div></div>
        </section>

        {pending ? <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-policy-heading" className="mt-6 rounded-xl border-2 border-violet-300 bg-violet-50 p-5"><h2 id="confirm-policy-heading" className="text-lg font-semibold text-violet-950">{pending.operation === "publish" ? "새 정책 버전 게시 확인" : "롤백 버전 생성 확인"}</h2><p className="mt-2 text-sm text-violet-900">현재 v{pending.expectedVersion}에서 v{pending.expectedVersion + 1}을 생성합니다. {pending.operation === "rollback" ? `선택한 대상 ${pending.targetVersionId}의 설정을 복사하며 현재 버전은 되돌릴 수 있는 경로로 남습니다.` : "현재 버전은 새 버전의 서버 생성 롤백 대상으로 남습니다."}</p><p className="mt-2 text-sm text-violet-900"><strong>사유:</strong> {pending.reason}</p><label className="mt-4 flex items-start gap-2 text-sm text-violet-950"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" />이 변경이 모더레이션 운영에 영향을 주며 새 불변 버전과 감사 로그가 생성됨을 확인했습니다.</label><div className="mt-4 flex gap-3"><button type="button" disabled={!confirmed || submitting} onClick={() => void submit()} className="rounded-md bg-violet-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{submitting ? "처리 중..." : "확인 및 실행"}</button><button type="button" disabled={submitting} onClick={() => { setPending(null); setConfirmed(false); }} className="rounded-md border border-violet-300 px-4 py-2 text-sm text-violet-900">취소</button></div></section> : null}

        <section aria-labelledby="policy-history-heading" className="mt-8"><h2 id="policy-history-heading" className="text-lg font-semibold text-zinc-900">버전 및 롤백 경로</h2>{state.data.versions.length === 0 ? <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">아직 게시된 정책 버전이 없습니다. 첫 게시 시 v1이 생성됩니다.</div> : <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white"><div className="hidden grid-cols-[80px_110px_1fr_180px_180px] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase text-zinc-500 md:grid"><span>버전</span><span>작업</span><span>사유</span><span>생성 시각</span><span>롤백 대상</span></div>{state.data.versions.map((item) => <article key={item.versionId} className="grid gap-2 border-b border-zinc-100 px-4 py-4 text-sm last:border-0 md:grid-cols-[80px_110px_1fr_180px_180px] md:gap-3"><strong>v{item.version}</strong><span className="text-zinc-600">{item.operation === "rollback" ? "롤백" : "게시"}</span><span className="text-zinc-800">{item.reason}</span><span className="text-zinc-500">{item.createdAt ? new Date(item.createdAt).toLocaleString("ko-KR") : "처리 중"}</span><code className="truncate text-xs text-zinc-500">{item.rollbackTargetId ?? "초기 버전"}</code></article>)}</div>}</section>
      </> : null}
    </main>
  </div>;
}
