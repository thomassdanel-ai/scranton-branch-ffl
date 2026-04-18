'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function IdentifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>IDENTIFY</b>
      </div>

      <div className="wrap">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
            gap: 40,
            padding: '56px 0',
            alignItems: 'center',
          }}
          className="identify-grid"
        >
          <section>
            <div className="kicker" style={{ marginBottom: 20 }}>
              <span className="kicker__dot" />
              ONE EMAIL · THIRTY-DAY COOKIE
            </div>
            <h1
              className="font-display"
              style={{
                fontSize: 'clamp(48px, 7vw, 88px)',
                lineHeight: 0.9,
                letterSpacing: 'var(--tr-wide)',
                color: 'var(--ink-8)',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Find<br />
              your <em style={{ fontStyle: 'normal', color: 'var(--accent-live)' }}>league.</em>
            </h1>
            <p
              style={{
                marginTop: 20,
                color: 'var(--ink-6)',
                fontSize: 'var(--fs-16)',
                lineHeight: 1.5,
                maxWidth: '46ch',
              }}
            >
              Enter the email you registered with. We&apos;ll pin your league to the nav,
              personalize your home screen, and jump you straight to standings. Works on any
              device — nothing to download.
            </p>

            <form
              onSubmit={handleSubmit}
              className="surface-raised"
              style={{
                padding: 24,
                marginTop: 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxWidth: 480,
              }}
            >
              <label htmlFor="email" className="label">
                Registered email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@work.dundermifflin.com"
                className="btn"
                style={{
                  height: 44,
                  width: '100%',
                  justifyContent: 'flex-start',
                  fontSize: 'var(--fs-14)',
                }}
                autoFocus
                required
              />

              {error && (
                <p
                  className="label"
                  style={{
                    color: 'var(--accent-danger)',
                    background: 'var(--accent-danger-wash)',
                    padding: '8px 12px',
                    borderRadius: 'var(--r-2)',
                    border: '1px solid var(--accent-danger-deep)',
                  }}
                >
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn--primary btn--lg"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {loading ? 'Looking up...' : 'Find me →'}
                </button>
                <Link href="/" className="btn btn--ghost btn--lg">
                  Cancel
                </Link>
              </div>

              <p className="label" style={{ marginTop: 8, lineHeight: 1.6, textTransform: 'none', letterSpacing: 0 }}>
                Email lookup only. We set a lightweight, httpOnly cookie so the nav and home
                screen can show your league. No password required.
              </p>
            </form>
          </section>

          {/* Right-side preview mock */}
          <section
            className="surface-raised identify-preview"
            style={{
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div className="kicker" style={{ marginBottom: 16 }}>
              <span className="kicker__dot" />
              PREVIEW · ONCE YOU&apos;RE IN
            </div>

            {/* Mock nav row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--ink-0)',
                border: 'var(--hairline)',
                borderRadius: 'var(--r-3)',
                marginBottom: 16,
              }}
            >
              <span className="topnav__brand-mark" style={{ width: 22, height: 22 }} aria-hidden />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-8)' }}>
                Scranton Branch FFL
              </span>
              <span style={{ marginLeft: 'auto' }} className="label">
                YOUR LEAGUE
              </span>
              <span
                style={{
                  color: 'var(--accent-live)',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Sales · Division
              </span>
            </div>

            {/* Mock ladder row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="label" style={{ paddingBottom: 6 }}>
                YOUR LADDER POSITION
              </div>
              <div className="rl__row rl__row--top">
                <span className="rl__rank">03</span>
                <span className="ava">YOU</span>
                <div>
                  <div className="rl__name">Your Team</div>
                  <div className="rl__meta">SALES · 8·3</div>
                </div>
                <div className="rl__score">
                  <span className="n">68.2</span>
                  <span className="d">▲ 2</span>
                </div>
              </div>
              <div className="rl__row">
                <span className="rl__rank">04</span>
                <span className="ava">—</span>
                <div>
                  <div className="rl__name" style={{ color: 'var(--ink-6)' }}>
                    Rival
                  </div>
                  <div className="rl__meta">SALES · 7·4</div>
                </div>
                <div className="rl__score">
                  <span className="n" style={{ color: 'var(--ink-6)' }}>
                    65.1
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: 'var(--hairline)',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span className="chip chip--live">
                <span className="livedot" /> Live scores
              </span>
              <span className="chip">Personalized home</span>
              <span className="chip">Bracket tracker</span>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.identify-grid) {
            grid-template-columns: 1fr !important;
            padding: 32px 0 !important;
          }
        }
      `}</style>
    </>
  );
}
