export function QueueSkeleton() {
  return (
    <div role="status" aria-label="모더레이션 큐 불러오는 중" className="rounded-xl border border-zinc-200 bg-white p-4">
      <span className="sr-only">불러오는 중...</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="mb-3 h-14 animate-pulse rounded-md bg-zinc-100 last:mb-0" />
      ))}
    </div>
  );
}

