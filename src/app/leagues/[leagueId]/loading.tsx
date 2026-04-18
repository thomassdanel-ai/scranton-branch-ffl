export default function LeagueLoading() {
  return (
    <div className="skel-stack" style={{ gap: 20, padding: '24px 0' }}>
      {/* League head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="skeleton skel-dot" />
        <div className="skel-stack" style={{ gap: 8 }}>
          <div className="skeleton skel-line" style={{ width: 80 }} />
          <div className="skeleton skel-line--display" style={{ width: 200 }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="skeleton" style={{ width: 96, height: 32, borderRadius: 999 }} />
        <div className="skeleton" style={{ width: 96, height: 32, borderRadius: 999 }} />
      </div>

      {/* Standings */}
      <div
        className="surface-raised"
        style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
      >
        <div
          className="skeleton"
          style={{ height: 3, width: '100%', borderRadius: 0 }}
        />
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 80px 80px 80px 72px 40px',
              gap: 12,
              paddingBottom: 12,
              borderBottom: 'var(--hairline)',
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton skel-line" />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 80px 80px 80px 72px 40px',
                gap: 12,
                padding: '14px 0',
                borderBottom: 'var(--hairline)',
                alignItems: 'center',
                opacity: 1 - i * 0.07,
              }}
            >
              <div className="skeleton skel-line--lg" style={{ width: 24 }} />
              <div className="skel-stack" style={{ gap: 6 }}>
                <div className="skeleton skel-line" style={{ width: 140 }} />
                <div className="skeleton skel-line" style={{ width: 90 }} />
              </div>
              <div className="skeleton skel-line" style={{ width: 48, justifySelf: 'center' }} />
              <div className="skeleton skel-line" style={{ width: 56, justifySelf: 'end' }} />
              <div className="skeleton skel-line" style={{ width: 56, justifySelf: 'end' }} />
              <div className="skeleton skel-line" style={{ width: 24, justifySelf: 'center' }} />
              <div className="skeleton skel-dot" style={{ justifySelf: 'center' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
