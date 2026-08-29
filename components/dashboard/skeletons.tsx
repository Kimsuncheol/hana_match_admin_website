function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 ${className}`} />;
}

export function MetricGridSkeleton() {
  return (
    <div role="status" aria-label="지표 불러오는 중" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4">
          <Pulse className="h-4 w-20" />
          <Pulse className="mt-2 h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div role="status" aria-label="목록 불러오는 중" className="rounded-lg border border-zinc-200 bg-white p-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Pulse key={i} className="mb-3 h-6 w-full last:mb-0" />
      ))}
    </div>
  );
}
