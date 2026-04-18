export default function HistoryLoading() {
  return (
    <div className="skel-stack" style={{ gap: 24, padding: '24px 0' }}>
      <div className="skel-stack" style={{ gap: 12, maxWidth: 560 }}>
        <div className="skeleton skel-line" style={{ width: 180 }} />
        <div className="skeleton skel-line--display" style={{ width: '80%' }} />
        <div className="skeleton skel-line--display" style={{ width: '60%' }} />
        <div className="skeleton skel-line" style={{ width: 420 }} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="surface-raised"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="skeleton skel-line--xl" style={{ width: 72 }} />
              <div className="skeleton skel-line" style={{ width: 110 }} />
            </div>
            <div
              className="skeleton"
              style={{ height: 44, borderRadius: 8 }}
            />
            <div className="skeleton skel-line" style={{ width: '70%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
