export default function HistoryLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-bg-tertiary rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-bg-tertiary rounded-sm mt-2 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-bg-tertiary rounded-sm animate-pulse" />
              <div className="h-5 w-5 bg-accent-gold/20 rounded-sm animate-pulse" />
            </div>
            <div className="h-4 w-48 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-4 w-36 bg-bg-tertiary rounded-sm animate-pulse" />
            <div className="h-px bg-white/5" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-bg-tertiary rounded-full animate-pulse" />
              <div className="h-4 w-24 bg-bg-tertiary rounded-sm animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
