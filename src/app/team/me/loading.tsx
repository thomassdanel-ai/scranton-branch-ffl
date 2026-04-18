export default function TeamMeLoading() {
  return (
    <div className="skel-stack" style={{ gap: 24, padding: '24px 0' }}>
      {/* Kicker + headline */}
      <div className="skel-stack" style={{ gap: 12, maxWidth: 520 }}>
        <div className="skeleton skel-line" style={{ width: 160 }} />
        <div className="skeleton skel-line--display" style={{ width: '80%' }} />
        <div className="skeleton skel-line--display" style={{ width: '55%' }} />
      </div>

      {/* Stat grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="surface-raised"
            style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div className="skeleton skel-line" style={{ width: 60 }} />
            <div className="skeleton skel-line--display" style={{ width: 72 }} />
            <div className="skeleton skel-line" style={{ width: 90 }} />
          </div>
        ))}
      </div>

      {/* Primary panel */}
      <div className="surface-raised" style={{ padding: 24, minHeight: 220 }}>
        <div className="skel-stack" style={{ gap: 12 }}>
          <div className="skeleton skel-line" style={{ width: 180 }} />
          <div className="skeleton skel-line" style={{ width: '90%' }} />
          <div className="skeleton skel-line" style={{ width: '70%' }} />
          <div className="skeleton skel-line" style={{ width: '80%' }} />
          <div className="skeleton skel-line" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
