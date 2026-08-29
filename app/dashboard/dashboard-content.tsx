"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { fetchDashboard, type DashboardFetchError } from "@/lib/dashboard/client";
import type { DashboardPayload } from "@/lib/dashboard/types";
import { AdminNav } from "@/components/nav/admin-nav";
import { MetricCard, MetricGrid } from "@/components/dashboard/metric-card";
import { PriorityQueue } from "@/components/dashboard/priority-queue";
import { ModelHealthPanel } from "@/components/dashboard/model-health";
import { MetricGridSkeleton, ListSkeleton } from "@/components/dashboard/skeletons";
import { DashboardErrorState } from "@/components/dashboard/error-state";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: DashboardFetchError }
  | { status: "ready"; data: DashboardPayload };

export function DashboardContent() {
  const { user, role, signOut } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // setState is called from inside the .then() callback, not the function
  // body directly — calling it synchronously within an effect (or a
  // function the effect awaits inline) triggers a cascading extra render.
  const load = useCallback(() => {
    if (!user) return;
    fetchDashboard(user).then((result) => {
      setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
    });
  }, [user]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || !role) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminNav role={role} email={user.email} onSignOut={() => void signOut()} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold text-zinc-900">운영 대시보드</h1>

        {state.status === "loading" ? (
          <div className="mt-6 flex flex-col gap-6">
            <MetricGridSkeleton />
            <ListSkeleton />
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="mt-6">
            <DashboardErrorState error={state.error} onRetry={retry} />
          </div>
        ) : null}

        {state.status === "ready" ? <DashboardData data={state.data} /> : null}
      </main>
    </div>
  );
}

function DashboardData({ data }: { data: DashboardPayload }) {
  return (
    <div className="mt-6 flex flex-col gap-8">
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          지표
        </h2>
        <MetricGrid>
          <MetricCard label="열린 케이스" value={String(data.metrics.openCases)} />
          {data.role === "admin" ? (
            <>
              <MetricCard
                label="SLA 위험"
                value={String(data.metrics.slaAtRisk)}
                tone={data.metrics.slaAtRisk > 0 ? "warning" : "neutral"}
              />
              <MetricCard
                label="SLA 초과"
                value={String(data.metrics.slaBreached)}
                tone={data.metrics.slaBreached > 0 ? "danger" : "neutral"}
              />
            </>
          ) : null}
          <MetricCard label="숨겨진 콘텐츠" value={String(data.metrics.hiddenContent)} />
          {data.role === "admin" ? (
            <MetricCard
              label="AI 지연 시간 (p95)"
              value={data.metrics.aiLatencyP95Ms !== null ? `${data.metrics.aiLatencyP95Ms}ms` : "데이터 없음"}
            />
          ) : null}
        </MetricGrid>
      </section>

      <section id="queue" aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-3 text-lg font-semibold text-zinc-900">
          우선순위 모더레이션 큐
        </h2>
        <PriorityQueue items={data.queue} />
      </section>

      {data.role === "admin" ? (
        <section id="model-health" aria-labelledby="model-health-heading">
          <h2 id="model-health-heading" className="mb-3 text-lg font-semibold text-zinc-900">
            AI 모델 상태
          </h2>
          <ModelHealthPanel entries={data.modelHealth} />
        </section>
      ) : null}
    </div>
  );
}
