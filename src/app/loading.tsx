export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-16 h-16 rounded-full border-4 border-bg-tertiary" />
        {/* Spinning ring */}
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        {/* Football icon */}
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          🏈
        </div>
      </div>
      <p className="text-text-muted text-sm mt-4 animate-pulse">
        Loading...
      </p>
    </div>
  );
}
