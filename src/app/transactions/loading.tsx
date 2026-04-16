export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div>
        <div className="h-8 w-48 bg-bg-tertiary rounded-lg animate-pulse" />
        <div className="h-4 w-80 bg-bg-tertiary rounded-sm mt-2 animate-pulse" />
      </div>

      {/* Transaction cards skeleton */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="glass-card p-4 space-y-3"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 bg-bg-tertiary rounded-full animate-pulse" />
              <div className="h-4 w-32 bg-bg-tertiary rounded-sm animate-pulse" />
            </div>
            <div className="h-3 w-20 bg-bg-tertiary rounded-sm animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-accent-green/20 rounded-sm animate-pulse" />
            <div className="h-4 w-36 bg-bg-tertiary rounded-sm animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-accent-red/20 rounded-sm animate-pulse" />
            <div className="h-4 w-28 bg-bg-tertiary rounded-sm animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
