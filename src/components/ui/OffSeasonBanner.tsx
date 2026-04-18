export default function OffSeasonBanner({ year }: { year: string }) {
  return (
    <div className="banner banner--warn">
      Showing final {year} season data. The next season hasn&apos;t been set up yet.
    </div>
  );
}
