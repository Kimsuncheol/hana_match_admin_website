import type { FormEvent } from "react";
import type { ModerationQueueFilters } from "@/lib/moderation/types";

type Props = {
  value: ModerationQueueFilters;
  disabled?: boolean;
  onChange: (filters: ModerationQueueFilters) => void;
  onApply: () => void;
  onReset: () => void;
};

const CONTROL_CLASS =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export function QueueFilters({ value, disabled, onChange, onApply, onReset }: Props) {
  function update<K extends keyof ModerationQueueFilters>(key: K, next: ModerationQueueFilters[K]) {
    onChange({ ...value, [key]: next, cursor: undefined });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }

  return (
    <form onSubmit={submit} aria-label="모더레이션 케이스 필터" className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-zinc-700">
          우선순위
          <select
            className={CONTROL_CLASS}
            value={value.priority}
            onChange={(event) => update("priority", event.target.value as ModerationQueueFilters["priority"])}
          >
            <option value="all">전체</option>
            <option value="critical">긴급</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          언어
          <input
            className={CONTROL_CLASS}
            value={value.language}
            onChange={(event) => update("language", event.target.value)}
            placeholder="예: ko, en-US"
            pattern="[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?"
            maxLength={12}
          />
        </label>

        <label className="text-sm font-medium text-zinc-700">
          담당
          <select
            className={CONTROL_CLASS}
            value={value.assignment}
            onChange={(event) => update("assignment", event.target.value as ModerationQueueFilters["assignment"])}
          >
            <option value="all">전체</option>
            <option value="unassigned">미할당</option>
            <option value="mine">내 케이스</option>
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          대상 유형
          <select
            className={CONTROL_CLASS}
            value={value.targetType}
            onChange={(event) => update("targetType", event.target.value as ModerationQueueFilters["targetType"])}
          >
            <option value="all">전체</option>
            <option value="profile_photo">프로필 사진</option>
            <option value="message">메시지</option>
            <option value="bio">자기소개</option>
            <option value="user_report">사용자 신고</option>
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          SLA 상태
          <select
            className={CONTROL_CLASS}
            value={value.slaRisk}
            onChange={(event) => update("slaRisk", event.target.value as ModerationQueueFilters["slaRisk"])}
          >
            <option value="all">전체</option>
            <option value="breached">기한 초과</option>
            <option value="at_risk">위험</option>
            <option value="ok">정상</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          초기화
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          필터 적용
        </button>
      </div>
    </form>
  );
}

