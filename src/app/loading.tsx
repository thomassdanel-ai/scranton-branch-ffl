'use client';

import { useEffect, useState } from 'react';

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        padding: '48px 16px',
      }}
    >
      <div style={{ position: 'relative', width: 56, height: 56, marginBottom: 20 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid var(--ink-3)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: 'var(--accent-live)',
            animation: 'spin 0.9s linear infinite',
          }}
        />
      </div>
      <span
        style={{
          font: '500 11px / 1 var(--font-mono)',
          letterSpacing: 'var(--tr-wider)',
          textTransform: 'uppercase',
          color: 'var(--accent-live)',
          marginBottom: 10,
        }}
      >
        LOADING
      </span>
      <p
        key={i}
        style={{
          color: 'var(--ink-6)',
          font: '400 var(--fs-13) / 1.4 var(--font-sans)',
          textAlign: 'center',
        }}
      >
        {MESSAGES[i]}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
