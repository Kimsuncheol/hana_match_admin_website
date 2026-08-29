import type { DashboardFetchError } from "@/lib/dashboard/client";

const MESSAGES: Record<DashboardFetchError["kind"], string> = {
  unauthenticated: "세션이 만료되었습니다. 다시 로그인해주세요.",
  forbidden: "이 데이터를 볼 수 있는 권한이 없습니다.",
  network: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
};

export function DashboardErrorState({
  error,
  onRetry,
}: {
  error: DashboardFetchError;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-800">{MESSAGES[error.kind]}</p>
      {onRetry && error.kind === "network" ? (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
