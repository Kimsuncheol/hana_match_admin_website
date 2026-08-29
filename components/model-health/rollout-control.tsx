"use client";

import { useState } from "react";
import type { AdminRole } from "@/lib/firebase/claims";
import type { ModelDeployment, RolloutMode, RolloutModeChangeInput } from "@/lib/model-health/types";

const MODE_LABELS: Record<RolloutMode, string> = { off: "꺼짐", shadow: "섀도", percentage: "부분 배포", full: "전체 배포" };

type Props = { deployment: ModelDeployment; role: AdminRole; submitting: boolean; onSubmit: (input: RolloutModeChangeInput) => void };

export function RolloutControl({ deployment, role, submitting, onSubmit }: Props) {
  const [mode, setMode] = useState<RolloutMode>(deployment.rolloutMode);
  const [percentage, setPercentage] = useState(deployment.rolloutPercentage);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const canChange = role === "superAdmin" && deployment.modelVersion !== "unconfigured";

  function updateMode(next: RolloutMode) {
    setMode(next);
    setPercentage(next === "full" ? 100 : next === "percentage" ? Math.max(1, Math.min(99, percentage || 10)) : 0);
    setConfirming(false); setConfirmed(false); setError(null);
  }
  function review() {
    if (reason.trim().length < 10 || reason.trim().length > 500) { setError("변경 사유는 10~500자로 입력하세요."); return; }
    if (mode === deployment.rolloutMode && percentage === deployment.rolloutPercentage) { setError("현재 배포 모드와 다른 값을 선택하세요."); return; }
    if (mode === "percentage" && (!Number.isInteger(percentage) || percentage < 1 || percentage > 99)) { setError("부분 배포 비율은 1~99의 정수여야 합니다."); return; }
    setError(null); setConfirming(true); setConfirmed(false);
  }

  return <section aria-labelledby="rollout-heading" className="rounded-xl border border-zinc-200 bg-white p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 id="rollout-heading" className="text-base font-semibold text-zinc-900">배포 및 롤백 상태</h2><p className="mt-1 text-sm text-zinc-500">모델 식별자와 롤백 대상은 서버가 소유하며 이 화면에서 변경할 수 없습니다.</p></div><span className="w-fit rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">{MODE_LABELS[deployment.rolloutMode]} {deployment.rolloutMode === "percentage" ? `${deployment.rolloutPercentage}%` : ""}</span></div>
    <dl className="mt-5 grid gap-4 rounded-lg bg-zinc-50 p-4 sm:grid-cols-3"><div><dt className="text-xs text-zinc-500">배포 모델 버전</dt><dd className="mt-1 break-all text-sm font-medium text-zinc-900">{deployment.modelVersion}</dd></div><div><dt className="text-xs text-zinc-500">롤백 대상</dt><dd className="mt-1 break-all text-sm font-medium text-zinc-900">{deployment.rollbackTarget ?? "설정되지 않음"}</dd></div><div><dt className="text-xs text-zinc-500">마지막 변경</dt><dd className="mt-1 text-sm font-medium text-zinc-900">{deployment.updatedAt ? new Date(deployment.updatedAt).toLocaleString("ko-KR") : "기록 없음"}</dd></div></dl>
    {!canChange ? <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{role === "superAdmin" ? "배포된 모델이 구성된 후 롤아웃 모드를 변경할 수 있습니다." : "롤아웃 변경은 superAdmin만 수행할 수 있습니다. 이 화면은 읽기 전용입니다."}</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">새 배포 모드<select value={mode} disabled={submitting || confirming} onChange={(event) => updateMode(event.target.value as RolloutMode)} className="rounded-md border border-zinc-300 bg-white px-3 py-2"><option value="off">꺼짐</option><option value="shadow">섀도</option><option value="percentage">부분 배포</option><option value="full">전체 배포</option></select></label><label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">배포 비율 (%)<input type="number" min={1} max={99} value={percentage} disabled={submitting || confirming || mode !== "percentage"} onChange={(event) => setPercentage(Number(event.target.value))} className="rounded-md border border-zinc-300 px-3 py-2 disabled:bg-zinc-100" /></label><label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 sm:col-span-2">필수 변경 사유<textarea rows={3} maxLength={500} value={reason} disabled={submitting || confirming} onChange={(event) => setReason(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2" /></label>{error ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}<div className="sm:col-span-2"><button type="button" disabled={submitting || confirming} onClick={review} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">변경 검토</button></div></div>}
    {confirming ? <div role="alertdialog" aria-modal="true" aria-labelledby="rollout-confirm-heading" className="mt-5 rounded-lg border-2 border-amber-300 bg-amber-50 p-4"><h3 id="rollout-confirm-heading" className="font-semibold text-amber-950">롤아웃 모드 변경 확인</h3><p className="mt-2 text-sm text-amber-900">{MODE_LABELS[deployment.rolloutMode]}에서 {MODE_LABELS[mode]}{mode === "percentage" ? ` ${percentage}%` : ""}(으)로 변경합니다. 모든 변경은 감사 로그에 기록됩니다.</p><p className="mt-1 text-sm text-amber-900"><strong>사유:</strong> {reason.trim()}</p><label className="mt-3 flex items-start gap-2 text-sm text-amber-950"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" />운영 영향과 감사 기록 생성을 확인했습니다.</label><div className="mt-3 flex gap-2"><button type="button" disabled={!confirmed || submitting} onClick={() => onSubmit({ mode, percentage, reason: reason.trim(), expectedVersion: deployment.stateVersion })} className="rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{submitting ? "변경 중..." : "확인 및 변경"}</button><button type="button" disabled={submitting} onClick={() => { setConfirming(false); setConfirmed(false); }} className="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-900">취소</button></div></div> : null}
  </section>;
}
