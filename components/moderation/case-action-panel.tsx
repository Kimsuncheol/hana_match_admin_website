"use client";

import { useState, type FormEvent } from "react";
import type { CaseDetailDto, ModerationAction, ModerationActionInput } from "@/lib/moderation/detail-types";

const ACTION_LABELS: Record<ModerationAction, string> = {
  confirm: "AI 판단 확인",
  correct: "라벨 수정",
  dismiss: "위반 아님",
  hide_content: "콘텐츠 임시 숨김",
  restore_content: "콘텐츠 복원",
  warn_user: "사용자 경고",
  rate_limit_talk: "Talk 24시간 속도 제한",
  request_permanent_suspension: "영구 정지 검토 요청",
};

type Props = {
  detail: CaseDetailDto;
  disabled: boolean;
  submitting: boolean;
  onSubmit: (input: ModerationActionInput) => void;
};

export function CaseActionPanel({ detail, disabled, submitting, onSubmit }: Props) {
  const [action, setAction] = useState<ModerationAction>("confirm");
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      caseId: detail.id,
      action,
      reason,
      expectedVersion: detail.version,
      ...(action === "correct" ? { correction } : {}),
    });
  }

  const decisionClosed = detail.status === "resolved" || detail.status === "dismissed";
  const actions: ModerationAction[] = [
    "confirm",
    "correct",
    "dismiss",
    detail.contentHidden ? "restore_content" : "hide_content",
    "warn_user",
    "rate_limit_talk",
    "request_permanent_suspension",
  ];
  const actionUnavailable =
    !actions.includes(action) ||
    ((action === "confirm" || action === "correct" || action === "dismiss") && decisionClosed) ||
    (action === "request_permanent_suspension" && detail.permanentSuspensionReview !== null);

  return (
    <section aria-labelledby="action-heading" className="rounded-xl border border-zinc-300 bg-white p-5">
      <h2 id="action-heading" className="text-lg font-semibold text-zinc-900">검토 조치</h2>
      <p className="mt-1 text-sm text-zinc-600">모든 조치는 사유, 변경 전후 상태, 실행자, correlationId와 함께 감사 로그에 기록됩니다.</p>

      {disabled ? (
        <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          조치하려면 먼저 큐에서 이 케이스를 내게 할당해야 합니다.
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-5">
        <fieldset disabled={disabled || submitting}>
          <legend className="text-sm font-medium text-zinc-700">조치 선택</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {actions.map((item) => {
              const unavailable =
                ((item === "confirm" || item === "correct" || item === "dismiss") && decisionClosed) ||
                (item === "request_permanent_suspension" && detail.permanentSuspensionReview !== null);
              return (
                <label key={item} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${unavailable ? "opacity-40" : "cursor-pointer hover:bg-zinc-50"}`}>
                  <input
                    type="radio"
                    name="moderation-action"
                    value={item}
                    checked={action === item}
                    disabled={unavailable}
                    onChange={() => setAction(item)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-zinc-900">{ACTION_LABELS[item]}</span>
                    {item === "request_permanent_suspension" ? (
                      <span className="mt-1 block text-xs text-red-700">즉시 정지하지 않으며 서로 다른 사람의 승인 2건이 필요합니다.</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

          {action === "correct" ? (
            <label className="mt-4 block text-sm font-medium text-zinc-700">
              수정 라벨
              <input
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
                minLength={2}
                maxLength={100}
                required
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
          ) : null}

          <label className="mt-4 block text-sm font-medium text-zinc-700">
            조치 사유
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
              rows={4}
              placeholder="적용한 정책과 판단 근거를 10자 이상 기록하세요."
              className="mt-1 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </label>

          <button
            type="submit"
            disabled={actionUnavailable}
            className="mt-4 w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? "안전하게 기록하는 중..." : `${ACTION_LABELS[action]} 제출`}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
