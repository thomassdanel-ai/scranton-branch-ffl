export default function BracketLoading() {
  return (
    <div className="skel-stack" style={{ gap: 24, padding: '24px 0' }}>
      {/* Headline */}
      <div className="skel-stack" style={{ gap: 12, maxWidth: 520 }}>
        <div className="skeleton skel-line" style={{ width: 220 }} />
        <div className="skeleton skel-line--display" style={{ width: '80%' }} />
        <div className="skeleton skel-line--display" style={{ width: '60%' }} />
        <div className="skeleton skel-line" style={{ width: 400 }} />
      </div>

      {/* Hero stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 520 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="surface-raised"
            style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div className="skeleton skel-line" style={{ width: 40 }} />
            <div className="skeleton skel-line--xl" style={{ width: 50 }} />
            <div className="skeleton skel-line" style={{ width: 72 }} />
          </div>
        ))}
      </div>

      {/* Bracket grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 8,
        }}
      >
        {[4, 4, 2, 1].map((count, colIdx) => (
          <div key={colIdx} className="skel-stack" style={{ gap: 10, paddingTop: colIdx * 20 }}>
            <div className="skeleton skel-line" style={{ width: 60, margin: '0 auto' }} />
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="surface-raised"
                style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <div className="skeleton skel-line" style={{ width: '80%' }} />
                <div className="skeleton skel-line" style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
