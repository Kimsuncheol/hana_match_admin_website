import type { SlaState } from "@/lib/dashboard/types";

const LABELS: Record<SlaState, string> = {
  ok: "정상",
  at_risk: "위험",
  breached: "기한 초과",
};

const CLASSES: Record<SlaState, string> = {
  ok: "bg-zinc-100 text-zinc-700",
  at_risk: "bg-amber-100 text-amber-800",
  breached: "bg-red-100 text-red-800",
};

/** Never relies on color alone: the text label carries the meaning, color is a reinforcement. */
export function SlaBadge({ state }: { state: SlaState }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CLASSES[state]}`}>
      {LABELS[state]}
    </span>
  );
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
