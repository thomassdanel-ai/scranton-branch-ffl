import type { ReactNode } from 'react';

/**
 * KickerLabel — small monospace chip used above every card title.
 * Establishes the "HUD readout" tone. Optionally includes a pulsing live dot
 * for realtime surfaces (current matchups, draft board, etc.).
 */
export default function KickerLabel({
  children,
  live = false,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  live?: boolean;
  tone?: 'default' | 'lime' | 'magenta' | 'cyan';
  className?: string;
}) {
  const toneColor =
    tone === 'lime'
      ? 'text-aurora-lime'
      : tone === 'magenta'
        ? 'text-aurora-magenta'
        : tone === 'cyan'
          ? 'text-aurora-cyan'
          : 'text-text-primary';

  return (
    <span className={`kicker ${toneColor} ${className}`}>
      {live && <span className="live-dot" />}
      {children}
    </span>
  );
}
