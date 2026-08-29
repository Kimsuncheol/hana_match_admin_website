import type { UserOperationsRow } from "@/lib/user-operations/types";

const FLAG_LABELS: Record<string, string> = { trusted: "신뢰", watch: "관찰", risk: "위험" };
const ACTION_LABELS: Record<string, string> = {
  confirm: "위반 확인",
  correct: "판단 수정",
  dismiss: "기각",
  warn_user: "경고",
  rate_limit_talk: "Talk 제한",
  disable_account: "계정 비활성화",
  enable_account: "계정 활성화",
  clear_talk_rate_limit: "Talk 제한 해제",
  add_trust_flag: "신뢰 플래그 추가",
  remove_trust_flag: "신뢰 플래그 제거",
};

function formatDate(iso: string | null): string {
  if (!iso) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function StateBadges({ user }: { user: UserOperationsRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.verification.emailVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
        {user.verification.emailVerified ? "이메일 인증" : "이메일 미인증"}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.status === "active" ? "bg-zinc-100 text-zinc-700" : "bg-red-100 text-red-800"}`}>
        {user.status === "active" ? "활성" : "비활성"}
      </span>
      {user.restrictions.talkRateLimitedUntil ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Talk 제한</span> : null}
      {user.restrictions.permanentSuspensionReviewPending ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">영구 정지 검토 중</span> : null}
    </div>
  );
}

function History({ items }: { items: UserOperationsRow["recentModerationHistory"] }) {
  if (items.length === 0) return <span className="text-xs text-zinc-500">기록 없음</span>;
  return (
    <ul className="space-y-1 text-xs text-zinc-600">
      {items.slice(0, 3).map((item, index) => (
        <li key={`${item.occurredAt}-${index}`}>
          <span className="font-medium text-zinc-800">{ACTION_LABELS[item.action] ?? item.action}</span> · {formatDate(item.occurredAt)}
          {item.evidenceContext ? <span className="block text-zinc-500">{item.evidenceContext.caseId ?? "사용자 조치"} · {item.evidenceContext.reason}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function UserTable({
  users,
  canMutate,
  onManage,
}: {
  users: UserOperationsRow[];
  canMutate: boolean;
  onManage: (user: UserOperationsRow) => void;
}) {
  if (users.length === 0) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center"><p className="text-sm font-medium text-zinc-800">조건에 맞는 사용자가 없습니다.</p><p className="mt-1 text-sm text-zinc-500">검색어나 필터를 조정해주세요.</p></div>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <caption className="sr-only">관리자 사용자 운영 검색 결과</caption>
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500"><tr>
            <th scope="col" className="px-4 py-3 font-medium">사용자</th><th scope="col" className="px-4 py-3 font-medium">상태</th><th scope="col" className="px-4 py-3 font-medium">신뢰 플래그</th><th scope="col" className="px-4 py-3 font-medium">최근 모더레이션</th><th scope="col" className="px-4 py-3 font-medium">최근 활동</th>{canMutate ? <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">작업</span></th> : null}
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">{users.map((user) => <tr key={user.uid} className="align-top">
            <td className="px-4 py-4"><p className="font-medium text-zinc-900">{user.maskedEmail}</p>{user.maskedDisplayName ? <p className="text-xs text-zinc-500">{user.maskedDisplayName}</p> : null}<p className="mt-1 font-mono text-xs text-zinc-400">{user.maskedUid}</p></td>
            <td className="px-4 py-4"><StateBadges user={user} /></td>
            <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{user.trustFlags.length ? user.trustFlags.map((flag) => <span key={flag} className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs">{FLAG_LABELS[flag] ?? flag}</span>) : <span className="text-xs text-zinc-500">없음</span>}</div></td>
            <td className="max-w-sm px-4 py-4"><History items={user.recentModerationHistory} /></td>
            <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-500">{formatDate(user.lastActivityAt)}</td>
            {canMutate ? <td className="px-4 py-4 text-right"><button type="button" onClick={() => onManage(user)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50" aria-label={`${user.maskedEmail} 관리`}>관리</button></td> : null}
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">{users.map((user) => <li key={user.uid} className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="font-medium text-zinc-900">{user.maskedEmail}</p><p className="font-mono text-xs text-zinc-400">{user.maskedUid}</p><div className="mt-3"><StateBadges user={user} /></div><div className="mt-3"><History items={user.recentModerationHistory} /></div><p className="mt-3 text-xs text-zinc-500">최근 활동 {formatDate(user.lastActivityAt)}</p>{canMutate ? <button type="button" onClick={() => onManage(user)} className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700" aria-label={`${user.maskedEmail} 관리`}>사용자 관리</button> : null}
      </li>)}</ul>
    </>
  );
}

