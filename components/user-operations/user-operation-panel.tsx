"use client";

import { useState, type FormEvent } from "react";
import type { UserOperationAction, UserOperationInput, UserOperationsRow } from "@/lib/user-operations/types";

type Selection = `${UserOperationAction}${"" | `:${"trusted" | "watch" | "risk"}`}`;

export function UserOperationPanel({
  user,
  submitting,
  onClose,
  onSubmit,
}: {
  user: UserOperationsRow;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: UserOperationInput) => void;
}) {
  const [selection, setSelection] = useState<Selection>(user.status === "active" ? "disable_account" : "enable_account");
  const [reason, setReason] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [action, flag] = selection.split(":") as [UserOperationAction, "trusted" | "watch" | "risk" | undefined];
    onSubmit({ userUid: user.uid, action, reason, expectedVersion: user.version, ...(flag ? { flag } : {}) });
  }
  return (
    <section aria-labelledby="user-operation-heading" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 id="user-operation-heading" className="text-lg font-semibold text-zinc-900">{user.maskedEmail} 관리</h2><p className="mt-1 text-sm text-zinc-600">변경은 privileged Cloud Function에서 검증되고 감사 로그에 기록됩니다.</p></div><button type="button" onClick={onClose} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">닫기</button></div>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-[minmax(220px,1fr)_2fr_auto] sm:items-end">
        <label className="text-sm font-medium text-zinc-700">조치
          <select value={selection} onChange={(event) => setSelection(event.target.value as Selection)} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value={user.status === "active" ? "disable_account" : "enable_account"}>{user.status === "active" ? "계정 비활성화" : "계정 활성화"}</option>
            {user.restrictions.talkRateLimitedUntil ? <option value="clear_talk_rate_limit">Talk 제한 해제</option> : null}
            <option value="add_trust_flag:trusted">신뢰 플래그 추가</option><option value="add_trust_flag:watch">관찰 플래그 추가</option><option value="add_trust_flag:risk">위험 플래그 추가</option>
            {user.trustFlags.includes("trusted") ? <option value="remove_trust_flag:trusted">신뢰 플래그 제거</option> : null}{user.trustFlags.includes("watch") ? <option value="remove_trust_flag:watch">관찰 플래그 제거</option> : null}{user.trustFlags.includes("risk") ? <option value="remove_trust_flag:risk">위험 플래그 제거</option> : null}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">변경 사유
          <input value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} maxLength={1000} placeholder="정책과 운영 근거를 10자 이상 입력" className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={submitting} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{submitting ? "기록 중..." : "조치 제출"}</button>
      </form>
    </section>
  );
}

