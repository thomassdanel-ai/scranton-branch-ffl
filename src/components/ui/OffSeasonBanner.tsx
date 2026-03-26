export default function OffSeasonBanner({ year }: { year: string }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      Showing final {year} season data. The next season hasn&apos;t been set up yet.
    </div>
  );
}
