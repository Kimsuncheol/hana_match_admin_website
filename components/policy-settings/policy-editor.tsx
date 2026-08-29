"use client";

import type { PolicyConfig, RolloutMode } from "@/lib/policy-settings/types";

type Props = { value: PolicyConfig; disabled: boolean; onChange: (value: PolicyConfig) => void };
type NumberInputProps = { label: string; value: number; min: number; max: number; step?: number; disabled: boolean; onChange: (value: number) => void };

function NumberInput({ label, value, min, max, step = 1, disabled, onChange }: NumberInputProps) {
  return <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">{label}<input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:bg-zinc-100" /></label>;
}

export function PolicyEditor({ value, disabled, onChange }: Props) {
  const setSection = <K extends keyof PolicyConfig>(key: K, next: PolicyConfig[K]) => onChange({ ...value, [key]: next });
  const thresholds = value.moderationThresholds;
  const expiry = value.reversibleActionExpiryHours;
  const limits = value.talkRateLimits;

  return <div className="grid gap-6 xl:grid-cols-2">
    <fieldset disabled={disabled} className="rounded-xl border border-zinc-200 bg-white p-5">
      <legend className="px-1 text-base font-semibold text-zinc-900">모더레이션 임계값</legend>
      <p className="mb-4 text-sm text-zinc-500">AI 점수는 검토 문맥이며, 이 값은 서버 정책 평가에만 사용됩니다.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput label="자동 숨김 신뢰도" value={thresholds.autoHideConfidence} min={0.5} max={1} step={0.01} disabled={disabled} onChange={(autoHideConfidence) => setSection("moderationThresholds", { ...thresholds, autoHideConfidence })} />
        <NumberInput label="에스컬레이션 신뢰도" value={thresholds.escalationConfidence} min={0.5} max={1} step={0.01} disabled={disabled} onChange={(escalationConfidence) => setSection("moderationThresholds", { ...thresholds, escalationConfidence })} />
        <NumberInput label="중대 위험 점수" value={thresholds.criticalRiskScore} min={1} max={100} disabled={disabled} onChange={(criticalRiskScore) => setSection("moderationThresholds", { ...thresholds, criticalRiskScore })} />
      </div>
    </fieldset>

    <fieldset disabled={disabled} className="rounded-xl border border-zinc-200 bg-white p-5">
      <legend className="px-1 text-base font-semibold text-zinc-900">규칙 버전</legend>
      <p className="mb-4 text-sm text-zinc-500">배포된 규칙 번들의 불변 식별자를 지정합니다.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.keys(value.ruleVersions) as Array<keyof PolicyConfig["ruleVersions"]>).map((key) => <label key={key} className="flex flex-col gap-1 text-sm font-medium text-zinc-700">{key}<input value={value.ruleVersions[key]} maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" onChange={(event) => setSection("ruleVersions", { ...value.ruleVersions, [key]: event.target.value })} className="rounded-md border border-zinc-300 px-3 py-2" /></label>)}
      </div>
    </fieldset>

    <fieldset disabled={disabled} className="rounded-xl border border-zinc-200 bg-white p-5">
      <legend className="px-1 text-base font-semibold text-zinc-900">가역 조치 만료</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput label="콘텐츠 숨김 (시간)" value={expiry.hiddenContent} min={1} max={2160} disabled={disabled} onChange={(hiddenContent) => setSection("reversibleActionExpiryHours", { ...expiry, hiddenContent })} />
        <NumberInput label="Talk 제한 (시간)" value={expiry.talkRateLimit} min={1} max={720} disabled={disabled} onChange={(talkRateLimit) => setSection("reversibleActionExpiryHours", { ...expiry, talkRateLimit })} />
        <NumberInput label="경고 유효기간 (시간)" value={expiry.warning} min={1} max={8760} disabled={disabled} onChange={(warning) => setSection("reversibleActionExpiryHours", { ...expiry, warning })} />
      </div>
    </fieldset>

    <fieldset disabled={disabled} className="rounded-xl border border-zinc-200 bg-white p-5">
      <legend className="px-1 text-base font-semibold text-zinc-900">Talk 속도 제한</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput label="분당 메시지" value={limits.messagesPerMinute} min={1} max={120} disabled={disabled} onChange={(messagesPerMinute) => setSection("talkRateLimits", { ...limits, messagesPerMinute })} />
        <NumberInput label="버스트" value={limits.burst} min={1} max={120} disabled={disabled} onChange={(burst) => setSection("talkRateLimits", { ...limits, burst })} />
        <NumberInput label="제한 시간 (분)" value={limits.restrictionMinutes} min={5} max={43200} disabled={disabled} onChange={(restrictionMinutes) => setSection("talkRateLimits", { ...limits, restrictionMinutes })} />
      </div>
    </fieldset>

    <fieldset disabled={disabled} className="rounded-xl border border-zinc-200 bg-white p-5 xl:col-span-2">
      <div className="flex items-center justify-between gap-3"><legend className="px-1 text-base font-semibold text-zinc-900">에스컬레이션 경로</legend><button type="button" disabled={disabled || value.escalationRoutes.length >= 10} onClick={() => setSection("escalationRoutes", [...value.escalationRoutes, { severity: "medium", destination: `route-${value.escalationRoutes.length + 1}`, slaMinutes: 120, enabled: true }])} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50">경로 추가</button></div>
      <div className="mt-4 space-y-3">
        {value.escalationRoutes.map((route, index) => <div key={index} className="grid gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[1fr_1.5fr_1fr_auto_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">심각도<select value={route.severity} onChange={(event) => { const routes = [...value.escalationRoutes]; routes[index] = { ...route, severity: event.target.value as typeof route.severity }; setSection("escalationRoutes", routes); }} className="rounded-md border border-zinc-300 bg-white px-3 py-2"><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option></select></label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">목적지<input value={route.destination} maxLength={48} onChange={(event) => { const routes = [...value.escalationRoutes]; routes[index] = { ...route, destination: event.target.value }; setSection("escalationRoutes", routes); }} className="rounded-md border border-zinc-300 px-3 py-2" /></label>
          <NumberInput label="SLA (분)" value={route.slaMinutes} min={5} max={10080} disabled={disabled} onChange={(slaMinutes) => { const routes = [...value.escalationRoutes]; routes[index] = { ...route, slaMinutes }; setSection("escalationRoutes", routes); }} />
          <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={route.enabled} onChange={(event) => { const routes = [...value.escalationRoutes]; routes[index] = { ...route, enabled: event.target.checked }; setSection("escalationRoutes", routes); }} />활성</label>
          <button type="button" disabled={value.escalationRoutes.length === 1} onClick={() => setSection("escalationRoutes", value.escalationRoutes.filter((_, routeIndex) => routeIndex !== index))} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-40">삭제</button>
        </div>)}
      </div>
    </fieldset>

    <fieldset disabled={disabled} className="rounded-xl border border-zinc-200 bg-white p-5">
      <legend className="px-1 text-base font-semibold text-zinc-900">기능 플래그</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(value.featureFlags) as Array<keyof PolicyConfig["featureFlags"]>).map((key) => <label key={key} className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800"><input type="checkbox" checked={value.featureFlags[key]} onChange={(event) => setSection("featureFlags", { ...value.featureFlags, [key]: event.target.checked })} />{key}</label>)}
      </div>
    </fieldset>

    <fieldset disabled={disabled} className="rounded-xl border border-zinc-200 bg-white p-5">
      <legend className="px-1 text-base font-semibold text-zinc-900">배포 모드</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">모드<select value={value.rollout.mode} onChange={(event) => { const mode = event.target.value as RolloutMode; setSection("rollout", { mode, percentage: mode === "full" ? 100 : mode === "percentage" ? Math.max(1, Math.min(99, value.rollout.percentage || 10)) : 0 }); }} className="rounded-md border border-zinc-300 bg-white px-3 py-2"><option value="off">꺼짐</option><option value="shadow">섀도</option><option value="percentage">부분 배포</option><option value="full">전체 배포</option></select></label>
        <NumberInput label="배포 비율 (%)" value={value.rollout.percentage} min={0} max={100} disabled={disabled || value.rollout.mode !== "percentage"} onChange={(percentage) => setSection("rollout", { ...value.rollout, percentage })} />
      </div>
    </fieldset>
  </div>;
}
