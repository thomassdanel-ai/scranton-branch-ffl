export default function MatchupsLoading() {
  return (
    <div className="skel-stack" style={{ gap: 16, padding: '24px 0' }}>
      {/* Week headline */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div className="skeleton skel-line--display" style={{ width: 180 }} />
        <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 999 }} />
      </div>

      {/* Week selector */}
      <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0 }}
          />
        ))}
      </div>

      {/* Matchup cards */}
      <div className="skel-stack" style={{ gap: 10, marginTop: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="surface-raised"
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: 20,
              alignItems: 'center',
              opacity: 1 - i * 0.1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="skeleton skel-dot" />
              <div className="skel-stack" style={{ gap: 6, flex: 1 }}>
                <div className="skeleton skel-line--lg" style={{ width: 140 }} />
                <div className="skeleton skel-line" style={{ width: 56 }} />
              </div>
              <div className="skeleton skel-line--xl" style={{ width: 56 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="skeleton skel-dot" />
              <div className="skel-stack" style={{ gap: 6, flex: 1 }}>
                <div className="skeleton skel-line--lg" style={{ width: 140 }} />
                <div className="skeleton skel-line" style={{ width: 56 }} />
              </div>
              <div className="skeleton skel-line--xl" style={{ width: 56 }} />
            </div>
            <div className="skeleton skel-line" style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
