import type { FormEvent } from "react";
import type { UserOperationsFilters } from "@/lib/user-operations/types";

const CONTROL = "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export function UserFilters({
  value,
  disabled,
  onChange,
  onApply,
  onReset,
}: {
  value: UserOperationsFilters;
  disabled: boolean;
  onChange: (value: UserOperationsFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  function set<K extends keyof UserOperationsFilters>(key: K, next: UserOperationsFilters[K]) {
    onChange({ ...value, [key]: next, cursor: undefined });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }
  return (
    <form aria-label="사용자 검색 및 필터" onSubmit={submit} className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-zinc-700 lg:col-span-2">
          이메일 또는 UID
          <input
            value={value.query}
            onChange={(event) => set("query", event.target.value)}
            placeholder="정확한 이메일 또는 UID"
            maxLength={128}
            className={CONTROL}
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          이메일 인증
          <select value={value.verification} onChange={(event) => set("verification", event.target.value as UserOperationsFilters["verification"])} className={CONTROL}>
            <option value="all">전체</option><option value="verified">인증됨</option><option value="unverified">미인증</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          계정 상태
          <select value={value.status} onChange={(event) => set("status", event.target.value as UserOperationsFilters["status"])} className={CONTROL}>
            <option value="all">전체</option><option value="active">활성</option><option value="disabled">비활성</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          제한 상태
          <select value={value.restriction} onChange={(event) => set("restriction", event.target.value as UserOperationsFilters["restriction"])} className={CONTROL}>
            <option value="all">전체</option><option value="restricted">제한 중</option><option value="clear">제한 없음</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          신뢰 플래그
          <select value={value.trust} onChange={(event) => set("trust", event.target.value as UserOperationsFilters["trust"])} className={CONTROL}>
            <option value="all">전체</option><option value="trusted">신뢰</option><option value="watch">관찰</option><option value="risk">위험</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={disabled} onClick={onReset} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">초기화</button>
        <button type="submit" disabled={disabled} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">검색 적용</button>
      </div>
    </form>
  );
}

