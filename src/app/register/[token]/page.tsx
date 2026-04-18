'use client';

import { useState, useEffect, use } from 'react';

type CohortInfo = {
  name: string;
  color: string;
  status: string;
  seasonYear: string;
  registeredCount: number;
};

export default function RegisterPage(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  const [cohort, setCohort] = useState<CohortInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    fetch(`/api/register/${params.token}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setCohort(data.cohort);
        } else {
          const data = await res.json();
          setError(data.error || 'Invalid invite link');
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/register/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, sleeperUsername: sleeperUsername || undefined }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
        setAlreadyRegistered(data.alreadyRegistered ?? false);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Network error');
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading&hellip;</p>
      </div>
    );
  }

  if (error && !cohort) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px 16px' }}>
        <div className="empty-state" style={{ maxWidth: 420, width: '100%' }}>
          <div className="empty-state__title">Oops</div>
          <div className="empty-state__body">{error}</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px 16px' }}>
        <div className="empty-state" style={{ maxWidth: 420, width: '100%', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>&#127944;</div>
          <div className="empty-state__title">
            {alreadyRegistered ? 'Already Registered!' : "You're In!"}
          </div>
          <div className="empty-state__body">
            {alreadyRegistered
              ? `You were already registered for ${cohort?.name}.`
              : `You've been registered for ${cohort?.name} (${cohort?.seasonYear} season). The commissioner will be in touch.`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px 16px' }}>
      <form
        onSubmit={handleSubmit}
        className="wiz-panel col col--sm"
        style={{ width: '100%', maxWidth: 420 }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 className="page-head__title" style={{ margin: 0 }}>{cohort?.name}</h1>
          <p className="wiz-panel__sub" style={{ marginTop: 4 }}>{cohort?.seasonYear} Season Registration</p>
          <p className="form-hint" style={{ marginTop: 2 }}>{cohort?.registeredCount} already signed up</p>
        </div>

        <div className="col col--sm">
          <label className="label" htmlFor="full-name">Full Name</label>
          <input
            id="full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="First and last name"
            className="input"
            autoFocus
            required
          />
        </div>

        <div className="col col--sm">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
            required
          />
        </div>

        <div className="col col--sm">
          <label className="label" htmlFor="sleeper-username">Sleeper Username</label>
          <div className="input-prefixed">
            <span className="input-prefixed__prefix">@</span>
            <input
              id="sleeper-username"
              type="text"
              value={sleeperUsername}
              onChange={(e) => setSleeperUsername(e.target.value)}
              placeholder="sleeper username"
            />
          </div>
          <p className="form-hint">Used to auto-detect when you join your league on Sleeper.</p>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className={`disclosure-toggle ${showGuide ? 'disclosure-toggle--open' : ''}`}
          >
            <svg
              className="disclosure-toggle__chev"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Where do I find this?
          </button>

          {showGuide && (
            <div className="guide-box">
              {[
                { step: 1, title: 'Open the Sleeper app', desc: 'Download Sleeper from the App Store or Google Play if you haven\'t already.' },
                { step: 2, title: 'Tap your profile icon', desc: 'It\'s in the bottom-right corner of the app.' },
                { step: 3, title: 'Find your username', desc: 'Your username is shown below your display name. It starts with @.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="guide-step">
                  <div className="guide-step__num">{step}</div>
                  <div className="guide-step__body">
                    <div className="guide-step__title">{title}</div>
                    <div className="guide-step__desc">{desc}</div>
                  </div>
                </div>
              ))}
              <p className="form-hint">
                Don&apos;t have Sleeper yet? No worries &mdash; you can skip this and the commissioner will help match you later.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="form-hint" style={{ color: 'var(--accent-danger)', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn btn--primary btn--lg"
          style={{ width: '100%' }}
        >
          {submitting ? 'Registering\u2026' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}
