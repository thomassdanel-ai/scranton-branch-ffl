import { SEASON_PHASE_ORDER, SEASON_PHASE_LABEL } from '@/lib/config';
import type { SeasonStatusValue } from '@/config/constants';

type PhaseStripProps = {
  year: string | number;
  phase: SeasonStatusValue | null;
  className?: string;
};

export default function PhaseStrip({ year, phase, className }: PhaseStripProps) {
  const currentIndex = phase ? SEASON_PHASE_ORDER.indexOf(phase) : -1;
  const phaseLabel = phase ? SEASON_PHASE_LABEL[phase].toUpperCase() : 'OFF-SEASON';
  const phaseNum = currentIndex >= 0 ? String(currentIndex + 1) : '—';
  const totalNum = SEASON_PHASE_ORDER.length;

  return (
    <div className={`phase-strip ${className ?? ''}`}>
      <span>
        {year} SEASON · PHASE {phaseNum} OF {totalNum}
      </span>
      <div className="phase-bar" aria-hidden>
        {SEASON_PHASE_ORDER.map((p, i) => {
          const state =
            currentIndex === -1
              ? ''
              : i < currentIndex
                ? 'pb-seg--done'
                : i === currentIndex
                  ? 'pb-seg--on'
                  : '';
          return <div key={p} className={`pb-seg ${state}`} />;
        })}
      </div>
      <span className={phase === 'active' || phase === 'playoffs' || phase === 'drafting' ? 'accent-live' : ''}>
        {phaseLabel}
      </span>
    </div>
  );
}
