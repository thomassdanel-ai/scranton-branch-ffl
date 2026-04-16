export default function RankingsLoading() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div>
        <div className="h-8 w-72 bg-bg-tertiary rounded-lg animate-pulse" />
        <div className="h-4 w-96 bg-bg-tertiary rounded-sm mt-2 animate-pulse" />
      </div>

      {/* Formula box skeleton */}
      <div className="glass-card p-4">
        <div className="h-3 w-24 bg-bg-tertiary rounded-sm animate-pulse mb-2" />
        <div className="h-3 w-full bg-bg-tertiary rounded-sm animate-pulse" />
        <div className="h-3 w-3/4 bg-bg-tertiary rounded-sm animate-pulse mt-1" />
      </div>

      {/* Table skeleton */}
      <div className="glass-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b border-white/5">
          <div className="h-4 w-8 bg-bg-tertiary rounded-sm animate-pulse" />
          <div className="h-4 w-32 bg-bg-tertiary rounded-sm animate-pulse" />
          <div className="h-4 w-16 bg-bg-tertiary rounded-sm animate-pulse ml-auto" />
          <div className="h-4 w-16 bg-bg-tertiary rounded-sm animate-pulse" />
          <div className="h-4 w-16 bg-bg-tertiary rounded-sm animate-pulse" />
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b border-white/5"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <div className="h-4 w-6 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-8 w-8 bg-bg-tertiary rounded-full animate-pulse" />
            <div className="h-4 w-28 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-4 w-20 bg-bg-tertiary rounded-sm animate-pulse ml-auto" />
            <div className="h-4 w-12 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-2 w-24 bg-bg-tertiary rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
