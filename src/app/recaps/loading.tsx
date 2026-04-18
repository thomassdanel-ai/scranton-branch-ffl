export default function RecapsLoading() {
  return (
    <div className="skel-stack" style={{ gap: 24, padding: '24px 0', maxWidth: 720, margin: '0 auto' }}>
      {/* Masthead */}
      <div className="skel-stack" style={{ gap: 10 }}>
        <div className="skeleton skel-line" style={{ width: 160 }} />
        <div className="skeleton skel-line--display" style={{ width: 280 }} />
        <div className="skeleton skel-line" style={{ width: 200 }} />
      </div>

      {/* Issue hero */}
      <div className="surface-raised" style={{ padding: 32 }}>
        <div className="skel-stack" style={{ gap: 14 }}>
          <div className="skeleton skel-line" style={{ width: 120 }} />
          <div className="skeleton skel-line--display" style={{ width: '95%' }} />
          <div className="skeleton skel-line--display" style={{ width: '60%' }} />
          <div className="skeleton skel-line" style={{ width: 180, marginTop: 12 }} />
        </div>
      </div>

      {/* Older issue cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="surface-raised"
          style={{
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 14,
            opacity: 1 - i * 0.15,
          }}
        >
          <div className="skel-stack" style={{ gap: 8, flex: 1 }}>
            <div className="skeleton skel-line--lg" style={{ width: 240 }} />
            <div className="skeleton skel-line" style={{ width: 120 }} />
          </div>
          <div className="skeleton skel-line--xl" style={{ width: 32 }} />
        </div>
      ))}
    </div>
  );
}
