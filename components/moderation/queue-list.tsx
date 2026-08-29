import Link from "next/link";
import { PriorityBadge, SlaBadge } from "@/components/dashboard/sla-badge";
import type { ModerationQueueCase } from "@/lib/moderation/types";

const TARGET_LABELS: Record<string, string> = {
  profile_photo: "프로필 사진",
  message: "메시지",
  bio: "자기소개",
  user_report: "사용자 신고",
};

function formatDue(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function AiContext({ item }: { item: ModerationQueueCase }) {
  const confidence = item.aiContext.confidence;
  return (
    <div className="max-w-xs text-xs text-zinc-600">
      <p className="font-medium text-violet-700">AI 참고 · 최종 판단 아님</p>
      <p className="mt-0.5">
        {item.aiContext.labels.length > 0 ? item.aiContext.labels.join(", ") : "라벨 없음"}
        {confidence !== null ? ` · ${Math.round(confidence * 100)}%` : ""}
      </p>
    </div>
  );
}

function AssignmentButton({
  item,
  actorUid,
  pending,
  onAssignment,
}: {
  item: ModerationQueueCase;
  actorUid: string;
  pending: boolean;
  onAssignment: (item: ModerationQueueCase, action: "assign_to_me" | "release") => void;
}) {
  const mine = item.assignedToUid === actorUid;
  const assignedToOther = item.assignedToUid !== null && !mine;
  return (
    <button
      type="button"
      disabled={pending || assignedToOther}
      onClick={() => onAssignment(item, mine ? "release" : "assign_to_me")}
      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={mine ? `${item.id} 할당 해제` : `${item.id} 내게 할당`}
    >
      {pending ? "처리 중..." : mine ? "할당 해제" : assignedToOther ? item.assignedToLabel ?? "할당됨" : "내게 할당"}
    </button>
  );
}

type Props = {
  items: ModerationQueueCase[];
  actorUid: string;
  pendingCaseId: string | null;
  onAssignment: (item: ModerationQueueCase, action: "assign_to_me" | "release") => void;
};

export function QueueList({ items, actorUid, pendingCaseId, onAssignment }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-zinc-800">조건에 맞는 케이스가 없습니다.</p>
        <p className="mt-1 text-sm text-zinc-500">필터를 조정하거나 새 케이스가 들어올 때 다시 확인하세요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">SLA / 우선순위</th>
              <th scope="col" className="px-4 py-3 font-medium">케이스</th>
              <th scope="col" className="px-4 py-3 font-medium">언어 / 대상</th>
              <th scope="col" className="px-4 py-3 font-medium">AI 검토 문맥</th>
              <th scope="col" className="px-4 py-3 font-medium">담당</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">작업</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="flex gap-1.5"><SlaBadge state={item.slaState} /><PriorityBadge priority={item.priority} /></div>
                  <p className="mt-2 whitespace-nowrap text-xs text-zinc-500">{formatDue(item.slaDueAt)}</p>
                </td>
                <td className="max-w-xs px-4 py-4">
                  <Link href={`/moderation/cases/${item.id}`} className="font-medium text-emerald-800 hover:underline">
                    {item.summary || `케이스 ${item.id}`}
                  </Link>
                  <p className="mt-1 font-mono text-xs text-zinc-400">{item.id}</p>
                </td>
                <td className="px-4 py-4 text-zinc-700">{item.language.toUpperCase()} · {TARGET_LABELS[item.targetType]}</td>
                <td className="px-4 py-4"><AiContext item={item} /></td>
                <td className="px-4 py-4">
                  <AssignmentButton item={item} actorUid={actorUid} pending={pendingCaseId === item.id} onAssignment={onAssignment} />
                </td>
                <td className="px-4 py-4 text-right">
                  <Link href={`/moderation/cases/${item.id}`} className="text-sm font-medium text-emerald-800 hover:underline">상세 검토</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-1.5"><SlaBadge state={item.slaState} /><PriorityBadge priority={item.priority} /></div>
            <Link href={`/moderation/cases/${item.id}`} className="mt-3 block font-medium text-emerald-800 hover:underline">
              {item.summary || `케이스 ${item.id}`}
            </Link>
            <p className="mt-1 text-xs text-zinc-500">{item.language.toUpperCase()} · {TARGET_LABELS[item.targetType]} · {formatDue(item.slaDueAt)}</p>
            <div className="mt-3 rounded-md bg-violet-50 p-2"><AiContext item={item} /></div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <AssignmentButton item={item} actorUid={actorUid} pending={pendingCaseId === item.id} onAssignment={onAssignment} />
              <Link href={`/moderation/cases/${item.id}`} className="text-sm font-medium text-emerald-800 hover:underline">상세 검토</Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

