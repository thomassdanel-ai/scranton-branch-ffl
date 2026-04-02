export default function MatchupsLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 bg-bg-tertiary rounded animate-pulse" />
        <div className="h-7 w-16 bg-accent-green/10 rounded-full animate-pulse" />
      </div>

      {/* Week selector skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-12 bg-bg-tertiary rounded animate-pulse shrink-0" />
        ))}
      </div>

      {/* Matchup card skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="glass-card p-4 space-y-3"
          style={{ opacity: 1 - i * 0.12 }}
        >
          {/* Team 1 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bg-tertiary rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-32 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-3 w-12 bg-bg-tertiary rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-bg-tertiary rounded animate-pulse" />
          </div>
          <div className="border-t border-white/5" />
          {/* Team 2 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bg-tertiary rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-28 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-3 w-12 bg-bg-tertiary rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-bg-tertiary rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
