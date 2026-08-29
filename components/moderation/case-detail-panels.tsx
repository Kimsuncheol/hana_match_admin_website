import { PriorityBadge, SlaBadge } from "@/components/dashboard/sla-badge";
import type { CaseDetailDto } from "@/lib/moderation/detail-types";

const TARGET_LABELS: Record<string, string> = {
  profile_photo: "프로필 사진",
  message: "메시지",
  bio: "자기소개",
  user_report: "사용자 신고",
};

const STATUS_LABELS: Record<CaseDetailDto["status"], string> = {
  open: "열림",
  in_review: "검토 중",
  resolved: "해결됨",
  dismissed: "기각됨",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function CaseSummary({ detail }: { detail: CaseDetailDto }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SlaBadge state={detail.sla.state} />
      <PriorityBadge priority={detail.priority} />
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
        {STATUS_LABELS[detail.status]}
      </span>
      <span className="text-xs text-zinc-500">SLA {formatDate(detail.sla.dueAt)}</span>
    </div>
  );
}

export function EvidencePanel({ detail }: { detail: CaseDetailDto }) {
  return (
    <section aria-labelledby="evidence-heading" className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="evidence-heading" className="text-lg font-semibold text-zinc-900">마스킹된 증거</h2>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">개인정보 마스킹됨</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-zinc-500">대상 유형</dt><dd className="mt-1 font-medium text-zinc-900">{TARGET_LABELS[detail.targetType]}</dd></div>
        <div><dt className="text-zinc-500">언어</dt><dd className="mt-1 font-medium uppercase text-zinc-900">{detail.language}</dd></div>
        <div><dt className="text-zinc-500">케이스 ID</dt><dd className="mt-1 break-all font-mono text-xs text-zinc-700">{detail.id}</dd></div>
      </dl>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-4 font-sans text-sm leading-6 text-zinc-100">
        {detail.maskedEvidence.preview}
      </pre>
    </section>
  );
}

export function AiReviewPanel({ detail }: { detail: CaseDetailDto }) {
  const suggestion = detail.aiContext.suggestion;
  return (
    <section aria-labelledby="ai-heading" className="rounded-xl border border-violet-200 bg-violet-50 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">검토 참고 전용</p>
        <h2 id="ai-heading" className="mt-1 text-lg font-semibold text-zinc-900">AI 분석</h2>
        <p className="mt-1 text-sm text-zinc-600">AI 결과는 자동 조치가 아니며 사람의 독립적인 판단이 필요합니다.</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-700">라벨과 신뢰도</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {detail.aiContext.labels.length > 0 ? detail.aiContext.labels.map((label) => (
              <span key={label} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-violet-800">{label}</span>
            )) : <span className="text-sm text-zinc-500">라벨 없음</span>}
          </div>
          <p className="mt-2 text-sm font-semibold tabular-nums text-zinc-900">
            {detail.aiContext.confidence === null ? "신뢰도 없음" : `신뢰도 ${Math.round(detail.aiContext.confidence * 100)}%`}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-700">감지된 규칙</h3>
          {detail.aiContext.rulesHit.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {detail.aiContext.rulesHit.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-zinc-500">감지된 규칙 없음</p>}
        </div>
      </div>

      {suggestion ? (
        <div className="mt-5 rounded-lg border border-violet-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">구조화된 AI 제안</h3>
          <dl className="mt-3 grid gap-3 text-sm">
            <div><dt className="font-medium text-zinc-500">권장 조치</dt><dd className="mt-0.5 text-zinc-800">{suggestion.recommendedAction}</dd></div>
            <div><dt className="font-medium text-zinc-500">근거</dt><dd className="mt-0.5 text-zinc-800">{suggestion.rationale}</dd></div>
            <div><dt className="font-medium text-zinc-500">정책 기준</dt><dd className="mt-0.5 text-zinc-800">{suggestion.policyBasis.join(", ") || "없음"}</dd></div>
            <div><dt className="font-medium text-zinc-500">주의사항</dt><dd className="mt-0.5 text-zinc-800">{suggestion.caution || "없음"}</dd></div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}

export function UserHistoryPanel({ detail }: { detail: CaseDetailDto }) {
  const items = [
    ["이전 케이스", detail.userHistory.priorCases],
    ["확인된 위반", detail.userHistory.confirmedViolations],
    ["경고", detail.userHistory.warnings],
    ["임시 제한", detail.userHistory.temporaryRestrictions],
    ["계정 사용 일수", detail.userHistory.accountAgeDays ?? "정보 없음"],
  ];
  return (
    <section aria-labelledby="history-heading" className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 id="history-heading" className="text-lg font-semibold text-zinc-900">사용자 이력 요약</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

