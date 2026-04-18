export default function TransactionsLoading() {
  return (
    <div className="skel-stack" style={{ gap: 20, padding: '24px 0' }}>
      {/* Headline */}
      <div className="skel-stack" style={{ gap: 12, maxWidth: 560 }}>
        <div className="skeleton skel-line" style={{ width: 180 }} />
        <div className="skeleton skel-line--display" style={{ width: '75%' }} />
        <div className="skeleton skel-line" style={{ width: 420 }} />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: 80, height: 28, borderRadius: 999 }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: 64, height: 28, borderRadius: 999 }}
            />
          ))}
        </div>
      </div>

      {/* Transaction cards */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="surface-raised"
          style={{ padding: 20, opacity: 1 - i * 0.1 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 14,
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 48, height: 20, borderRadius: 999 }} />
              <div className="skeleton skel-line" style={{ width: 40 }} />
            </div>
            <div className="skeleton skel-line" style={{ width: 80 }} />
          </div>
          <div className="skel-stack" style={{ gap: 8 }}>
            <div className="skeleton skel-line--lg" style={{ width: 140 }} />
            <div className="skeleton skel-line" style={{ width: 220 }} />
            <div className="skeleton skel-line" style={{ width: 180 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
