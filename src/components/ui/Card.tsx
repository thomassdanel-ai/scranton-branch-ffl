import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

/**
 * Card — the core Bento HUD surface.
 *
 * Wraps the `.panel` utility from globals.css (frosted glass with hairline
 * border; aurora bleeds through). Offers optional gradient-edge variants for
 * cards that need extra emphasis (champion card, live matchup, etc.).
 */

type EdgeVariant = 'none' | 'lime' | 'mag' | 'cyan';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  edge?: EdgeVariant;
  interactive?: boolean;
  as?: 'div' | 'a' | 'section' | 'article';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8 md:p-10',
};

const edgeMap: Record<EdgeVariant, string> = {
  none: '',
  lime: 'panel-edge-lime',
  mag: 'panel-edge-mag',
  cyan: 'panel-edge-cyan',
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { edge = 'none', interactive = false, padding = 'md', className = '', children, ...rest },
  ref,
) {
  const classes = [
    'panel',
    edgeMap[edge],
    interactive ? 'panel--interactive cursor-pointer' : 'panel--static',
    paddingMap[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
});

export default Card;
