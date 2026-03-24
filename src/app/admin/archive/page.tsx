'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ArchiveSeasonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [seasonYear, setSeasonYear] = useState('');

  useEffect(() => {
    fetch('/api/admin/season')
      .then((res) => {
        if (res.status === 401) { router.push('/admin'); return null; }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const year = data.season?.year ?? data.fallbackConfig?.currentSeason ?? '';
        setSeasonYear(year);
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleArchive() {
    if (!confirmed) {
      setMessage('Please check the confirmation box first.');
      return;
    }
    setArchiving(true);
    setMessage('');

    const res = await fetch('/api/admin/archive', { method: 'POST' });
    if (res.ok) {
      setMessage(`${seasonYear} season archived successfully! You can now set up the new season.`);
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error}`);
    }
    setArchiving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Archive Season</h1>
        <p className="text-text-secondary text-sm mt-1">
          Snapshot the {seasonYear} season data for the permanent historical record.
        </p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="font-bold text-white">What gets archived:</h2>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Final standings for all leagues
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Power rankings snapshot
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Championship bracket results
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Season awards (most points, best record, champion)
          </li>
        </ul>
      </div>

      <div className="glass-card p-6 space-y-4 border border-accent-red/20">
        <h2 className="font-bold text-accent-red">Confirm Archive</h2>
        <p className="text-text-secondary text-sm">
          This action takes a permanent snapshot of the {seasonYear} season.
          You should do this after the championship is decided, before setting up the new season.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-bg-tertiary"
          />
          <span className="text-sm text-text-primary">
            I confirm I want to archive the {seasonYear} season
          </span>
        </label>

        <button
          onClick={handleArchive}
          disabled={archiving || !confirmed}
          className="px-6 py-2 bg-accent-red text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {archiving ? 'Archiving...' : `Archive ${seasonYear} Season`}
        </button>

        {message && (
          <p className={`text-sm ${message.startsWith('Error') ? 'text-accent-red' : 'text-accent-green'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
