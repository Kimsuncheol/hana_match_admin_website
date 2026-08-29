import type { ModelHealthPayload } from "@/lib/model-health/types";

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "danger" }) {
  return <article className={`rounded-xl border bg-white p-5 ${tone === "danger" ? "border-red-200" : "border-zinc-200"}`}><p className="text-sm text-zinc-500">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${tone === "danger" ? "text-red-700" : "text-zinc-950"}`}>{value}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></article>;
}

export function HealthSummary({ data }: { data: ModelHealthPayload }) {
  return <section aria-labelledby="health-summary-heading"><h2 id="health-summary-heading" className="sr-only">모델 상태 요약</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Metric label="중앙 지연 시간" value={data.medianLatencyMs === null ? "데이터 없음" : `${data.medianLatencyMs}ms`} detail={`최근 ${data.window.inferenceHours}시간 · ${data.inferenceSamples}개 샘플`} />
    <Metric label="검토자 오버라이드율" value={data.overrideRatePct === null ? "데이터 없음" : `${data.overrideRatePct}%`} detail={`최근 ${data.window.reviewsDays}일 · ${data.reviewSamples}개 검토`} />
    <Metric label="추론 실패" value={String(data.failures)} detail={`최근 ${data.window.inferenceHours}시간`} tone={data.failures > 0 ? "danger" : "neutral"} />
    <Metric label="배포 모델" value={data.deployment.modelVersion} detail={`상태 버전 ${data.deployment.stateVersion}`} />
  </div></section>;
}
