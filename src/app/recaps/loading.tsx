export default function RecapsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-bg-tertiary rounded-lg animate-pulse" />

      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="glass-card p-6 space-y-3"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-5 w-48 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-4 w-16 bg-bg-tertiary rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-bg-tertiary rounded-full animate-pulse" />
              <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
