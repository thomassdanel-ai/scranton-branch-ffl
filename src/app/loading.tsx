'use client';

import { useEffect, useState } from 'react';

// Scranton-flavored loading copy. Rotates every ~1.6s so the page feels alive
// even during slow fetches. All copy is Dunder-Mifflin-adjacent on purpose.
const MESSAGES = [
  'Faxing the commissioner…',
  'Counting beets per acre…',
  'Dwight is auditing the numbers.',
  'Kevin is doing the math. Please wait.',
  'Warming up the paper press…',
  'Michael is making a decision. This will take a while.',
  'Stanley is updating the spreadsheet.',
  'Creed is… doing whatever Creed does.',
];

export default function Loading() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => (n + 1) % MESSAGES.length);
    }, 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-16 h-16 rounded-full border-4 border-bg-tertiary" />
        {/* Spinning ring */}
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        {/* Football icon */}
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          🏈
        </div>
      </div>
      <p
        key={i}
        className="text-text-muted text-sm mt-4 animate-pulse transition-opacity"
      >
        {MESSAGES[i]}
      </p>
    </div>
  );
}
