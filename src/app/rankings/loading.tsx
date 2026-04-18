export default function RankingsLoading() {
  return (
    <div className="skel-stack" style={{ gap: 24, padding: '24px 0' }}>
      {/* Headline */}
      <div className="skel-stack" style={{ gap: 12, maxWidth: 520 }}>
        <div className="skeleton skel-line" style={{ width: 180 }} />
        <div className="skeleton skel-line--display" style={{ width: '90%' }} />
        <div className="skeleton skel-line--display" style={{ width: '70%' }} />
      </div>

      {/* Formula grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          maxWidth: 520,
          marginLeft: 'auto',
          marginTop: -80,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="surface-raised"
            style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div className="skeleton skel-line" style={{ width: 48 }} />
            <div className="skeleton skel-line--xl" style={{ width: 36 }} />
            <div className="skeleton skel-line" style={{ height: 2, width: '100%' }} />
          </div>
        ))}
      </div>

      {/* Ladder rows */}
      <div className="skel-stack" style={{ gap: 10, marginTop: 20 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="surface-raised"
            style={{
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: '48px 1fr auto',
              alignItems: 'center',
              gap: 16,
              opacity: 1 - i * 0.08,
            }}
          >
            <div className="skeleton skel-line--display" style={{ width: 32 }} />
            <div className="skel-stack" style={{ gap: 6 }}>
              <div className="skeleton skel-line--lg" style={{ width: 140 }} />
              <div className="skeleton skel-line" style={{ width: 200 }} />
            </div>
            <div className="skeleton skel-line--xl" style={{ width: 60 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
