export default function TeamMeLoading() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      <div className="mb-8">
        <div className="h-3 w-40 bg-bg-tertiary rounded mb-2" />
        <div className="h-10 w-64 bg-bg-tertiary rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-bg-secondary/60 border border-bg-tertiary rounded-xl" />
        ))}
      </div>
      <div className="h-56 bg-bg-secondary/60 border border-bg-tertiary rounded-xl mb-8" />
      <div className="h-72 bg-bg-secondary/60 border border-bg-tertiary rounded-xl" />
    </main>
  );
}
