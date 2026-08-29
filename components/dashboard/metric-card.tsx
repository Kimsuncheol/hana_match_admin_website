type Props = {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "danger";
  hint?: string;
};

const TONE_CLASSES: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "border-zinc-200 bg-white",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-red-200 bg-red-50",
};

const VALUE_TONE_CLASSES: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "text-zinc-900",
  warning: "text-amber-800",
  danger: "text-red-800",
};

export function MetricCard({ label, value, tone = "neutral", hint }: Props) {
  return (
    <div className={`rounded-lg border p-4 ${TONE_CLASSES[tone]}`}>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${VALUE_TONE_CLASSES[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}
