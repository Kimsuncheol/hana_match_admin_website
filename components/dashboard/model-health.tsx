import type { ModelHealthEntry, ModelStatus } from "@/lib/dashboard/types";

const STATUS_LABELS: Record<ModelStatus, string> = {
  healthy: "정상",
  degraded: "저하됨",
  down: "장애",
};

const STATUS_CLASSES: Record<ModelStatus, string> = {
  healthy: "bg-emerald-100 text-emerald-800",
  degraded: "bg-amber-100 text-amber-800",
  down: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: ModelStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ModelHealthPanel({ entries }: { entries: ModelHealthEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        최근 24시간 동안 수집된 AI 지연 시간 데이터가 없습니다.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
      {entries.map((entry) => (
        <li key={entry.model} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={entry.status} />
            <span className="text-sm font-medium text-zinc-900">{entry.model}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 tabular-nums">
            <span>p50 {entry.p50Ms}ms</span>
            <span>p95 {entry.p95Ms}ms</span>
            <span>오류율 {entry.errorRatePct}%</span>
            <span>샘플 {entry.sampleCount}건</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
