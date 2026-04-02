export default function BracketLoading() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div className="text-center">
        <div className="h-8 w-64 bg-bg-tertiary rounded-lg animate-pulse mx-auto" />
        <div className="h-4 w-96 bg-bg-tertiary rounded mt-2 animate-pulse mx-auto" />
      </div>

      {/* Bracket skeleton */}
      <div className="flex items-start justify-center gap-8 overflow-x-auto py-8">
        {/* Round 1 */}
        <div className="space-y-4 flex-shrink-0">
          <div className="h-5 w-24 bg-bg-tertiary rounded animate-pulse mx-auto" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card w-48 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-bg-tertiary rounded animate-pulse" />
                <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse" />
                <div className="h-4 w-8 bg-bg-tertiary rounded animate-pulse ml-auto" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-bg-tertiary rounded animate-pulse" />
                <div className="h-4 w-28 bg-bg-tertiary rounded animate-pulse" />
                <div className="h-4 w-8 bg-bg-tertiary rounded animate-pulse ml-auto" />
              </div>
            </div>
          ))}
        </div>
        {/* Round 2 */}
        <div className="space-y-4 flex-shrink-0 pt-12">
          <div className="h-5 w-24 bg-bg-tertiary rounded animate-pulse mx-auto" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass-card w-48 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-bg-tertiary rounded animate-pulse" />
                <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-bg-tertiary rounded animate-pulse" />
                <div className="h-4 w-28 bg-bg-tertiary rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        {/* Final */}
        <div className="space-y-4 flex-shrink-0 pt-24">
          <div className="h-5 w-28 bg-bg-tertiary rounded animate-pulse mx-auto" />
          <div className="glass-card w-48 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-accent-gold/30 rounded animate-pulse" />
              <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-accent-gold/30 rounded animate-pulse" />
              <div className="h-4 w-28 bg-bg-tertiary rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
