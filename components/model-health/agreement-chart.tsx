import type { LanguageAgreement, LanguageGroup } from "@/lib/model-health/types";

const LABELS: Record<LanguageGroup, string> = { ko: "한국어", ja: "일본어", mixed: "혼합 언어" };

export function AgreementChart({ values }: { values: LanguageAgreement[] }) {
  return <figure className="rounded-xl border border-zinc-200 bg-white p-5" aria-labelledby="agreement-chart-title">
    <figcaption id="agreement-chart-title" className="text-base font-semibold text-zinc-900">언어별 인간 검토 일치율</figcaption>
    <p className="mt-1 text-sm text-zinc-500">최근 30일 검토 결과. 막대 값은 아래 표와 동일합니다.</p>
    <div className="mt-5 space-y-4" role="img" aria-label={values.map((item) => `${LABELS[item.language]} ${item.agreementPct === null ? "데이터 없음" : `${item.agreementPct}%`}`).join(", ")}>
      {values.map((item) => <div key={item.language}>
        <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-zinc-800">{LABELS[item.language]}</span><span className="tabular-nums text-zinc-600">{item.agreementPct === null ? "데이터 없음" : `${item.agreementPct}%`} · {item.reviewCount}건</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${item.agreementPct ?? 0}%` }} /></div>
      </div>)}
    </div>
    <table className="sr-only"><caption>언어별 인간 검토 일치율 데이터</caption><thead><tr><th>언어</th><th>일치율</th><th>일치 건수</th><th>검토 건수</th></tr></thead><tbody>{values.map((item) => <tr key={item.language}><th>{LABELS[item.language]}</th><td>{item.agreementPct === null ? "데이터 없음" : `${item.agreementPct}%`}</td><td>{item.agreedReviews}</td><td>{item.reviewCount}</td></tr>)}</tbody></table>
  </figure>;
}
