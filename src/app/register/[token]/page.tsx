'use client';

import { useState, useEffect } from 'react';

type CohortInfo = {
  name: string;
  color: string;
  status: string;
  seasonYear: string;
  registeredCount: number;
};

export default function RegisterPage({ params }: { params: { token: string } }) {
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (error && !cohort) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-white mb-2">Oops</h1>
          <p className="text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 w-full max-w-sm text-center space-y-3">
          <div className="text-4xl">&#127944;</div>
          <h1 className="text-xl font-bold text-white">
            {alreadyRegistered ? 'Already Registered!' : "You're In!"}
          </h1>
          <p className="text-text-muted">
            {alreadyRegistered
              ? `You were already registered for ${cohort?.name}.`
              : `You've been registered for ${cohort?.name} (${cohort?.seasonYear} season). The commissioner will be in touch.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <form onSubmit={handleSubmit} className="glass-card p-8 w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-white">{cohort?.name}</h1>
          <p className="text-text-muted text-sm">{cohort?.seasonYear} Season Registration</p>
          <p className="text-text-muted text-xs">{cohort?.registeredCount} already signed up</p>
        </div>

        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
          autoFocus
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
          required
        />

        {/* Sleeper username with guided walkthrough */}
        <div className="space-y-2">
          <div className="flex items-center rounded-lg bg-bg-tertiary border border-white/10 focus-within:border-primary">
            <span className="pl-4 text-text-muted select-none">@</span>
            <input
              type="text"
              value={sleeperUsername}
              onChange={(e) => setSleeperUsername(e.target.value)}
              placeholder="Sleeper username"
              className="w-full px-2 py-2 bg-transparent text-white placeholder-text-muted focus:outline-none"
            />
          </div>
          <p className="text-text-muted text-xs">
            Used to auto-detect when you join your league on Sleeper
          </p>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="text-primary text-xs font-medium hover:text-primary-light transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${showGuide ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Where do I find this?
          </button>

          {showGuide && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-4 text-sm">
              {[
                { step: 1, title: 'Open the Sleeper app', desc: 'Download Sleeper from the App Store or Google Play if you haven\'t already.' },
                { step: 2, title: 'Tap your profile icon', desc: 'It\'s in the bottom-right corner of the app.' },
                { step: 3, title: 'Find your username', desc: 'Your username is shown below your display name. It starts with @.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                    {step}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-white font-medium">{title}</p>
                    <p className="text-text-muted text-xs">{desc}</p>
                    {/* Screenshot placeholder -- drop actual screenshots in /public/images/sleeper-guide/ */}
                    <img
                      src={`/images/sleeper-guide/step-${step}.png`}
                      alt={`Step ${step}: ${title}`}
                      className="rounded-lg border border-white/10 w-full max-w-[200px] hidden"
                      onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('hidden'); }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-text-muted text-xs pt-1">
                Don&apos;t have Sleeper yet? No worries — you can skip this and the commissioner will help match you later.
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-accent-red text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {submitting ? 'Registering...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}
