/**
 * AuroraBackground — fixed, non-interactive mesh of drifting aurora blobs.
 * Sits at z-index 0 behind all content. Each blob is a giant blurred radial
 * gradient that slowly translates on a long easing loop. The overall effect
 * is an ambient "living" dark-mode canvas.
 *
 * Drop once at the root (or any section that wants its own aurora field).
 */
export default function AuroraBackground({
  variant = 'default',
}: {
  variant?: 'default' | 'muted';
}) {
  // Muted variant for pages where content density needs more contrast.
  const opacity = variant === 'muted' ? 0.35 : 0.6;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{ opacity }}
    >
      {/* Magenta bloom — top-left */}
      <div
        className="absolute animate-drift-1"
        style={{
          top: '-15%',
          left: '-10%',
          width: '55vw',
          height: '55vw',
          background:
            'radial-gradient(circle at center, rgba(224,86,255,0.55) 0%, rgba(224,86,255,0) 60%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Cyan bloom — top-right */}
      <div
        className="absolute animate-drift-2"
        style={{
          top: '-10%',
          right: '-15%',
          width: '50vw',
          height: '50vw',
          background:
            'radial-gradient(circle at center, rgba(86,240,255,0.45) 0%, rgba(86,240,255,0) 60%)',
          filter: 'blur(90px)',
        }}
      />
      {/* Violet bloom — mid-left */}
      <div
        className="absolute animate-drift-3"
        style={{
          top: '35%',
          left: '-20%',
          width: '60vw',
          height: '60vw',
          background:
            'radial-gradient(circle at center, rgba(157,127,255,0.35) 0%, rgba(157,127,255,0) 60%)',
          filter: 'blur(100px)',
        }}
      />
      {/* Lime bloom — bottom-right */}
      <div
        className="absolute animate-drift-4"
        style={{
          bottom: '-20%',
          right: '-10%',
          width: '55vw',
          height: '55vw',
          background:
            'radial-gradient(circle at center, rgba(204,255,86,0.25) 0%, rgba(204,255,86,0) 65%)',
          filter: 'blur(110px)',
        }}
      />

      {/* Vignette to keep edges from bleeding too bright */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(8,8,10,0) 40%, rgba(8,8,10,0.85) 100%)',
        }}
      />
    </div>
  );
}
