export default function LeagueLoading() {
  return (
    <div className="space-y-6">
      {/* League header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-8 bg-bg-tertiary rounded-sm animate-pulse" />
        <div className="h-7 w-40 bg-bg-tertiary rounded-lg animate-pulse" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-white/5 pb-2">
        <div className="h-5 w-24 bg-bg-tertiary rounded-sm animate-pulse" />
        <div className="h-5 w-24 bg-bg-tertiary rounded-sm animate-pulse" />
      </div>

      {/* Standings table skeleton */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 flex items-center gap-4 border-b border-white/5">
          <div className="h-4 w-8 bg-bg-tertiary rounded-sm animate-pulse" />
          <div className="h-4 w-40 bg-bg-tertiary rounded-sm animate-pulse" />
          <div className="h-4 w-12 bg-bg-tertiary rounded-sm animate-pulse ml-auto" />
          <div className="h-4 w-16 bg-bg-tertiary rounded-sm animate-pulse" />
          <div className="h-4 w-16 bg-bg-tertiary rounded-sm animate-pulse" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="p-4 flex items-center gap-4 border-b border-white/5"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <div className="h-4 w-6 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-8 w-8 bg-bg-tertiary rounded-full animate-pulse" />
            <div className="h-4 w-32 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-4 w-16 bg-bg-tertiary rounded-sm animate-pulse ml-auto" />
            <div className="h-4 w-20 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-4 w-16 bg-bg-tertiary rounded-sm animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
