import type { QueueItem } from "@/lib/dashboard/types";
import { PriorityBadge, SlaBadge } from "./sla-badge";

const CATEGORY_LABELS: Record<string, string> = {
  profile_photo: "프로필 사진",
  message: "메시지",
  bio: "자기소개",
  report_user: "사용자 신고",
};

function formatDue(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PriorityQueue({ items }: { items: QueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        처리할 케이스가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              SLA
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              우선순위
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              분류
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              요약
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              기한
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3">
                <SlaBadge state={item.slaState} />
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={item.priority} />
              </td>
              <td className="px-4 py-3 text-zinc-700">{CATEGORY_LABELS[item.category] ?? item.category}</td>
              <td className="px-4 py-3 text-zinc-700">{item.summary}</td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{formatDue(item.slaDueAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
