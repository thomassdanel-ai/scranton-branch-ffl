'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface LeagueEntry {
  id: string;
  name: string;
  shortName: string;
  color: string;
}

interface SeasonConfig {
  name: string;
  shortName: string;
  commissionerUserId: string;
  currentSeason: string;
  leagues: LeagueEntry[];
  championship: {
    qualifiersPerLeague: number;
    format: string;
  };
}

export default function SeasonManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [config, setConfig] = useState<SeasonConfig | null>(null);
  const [year, setYear] = useState('');

  useEffect(() => {
    fetch('/api/admin/season')
      .then((res) => {
        if (res.status === 401) {
          router.push('/admin');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const cfg = data.season?.config ?? data.fallbackConfig;
        setConfig(cfg);
        setYear(data.season?.year ?? cfg.currentSeason);
      })
      .finally(() => setLoading(false));
  }, [router]);

  function updateLeague(index: number, field: keyof LeagueEntry, value: string) {
    if (!config) return;
    const updated = [...config.leagues];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, leagues: updated });
  }

  function addLeague() {
    if (!config) return;
    setConfig({
      ...config,
      leagues: [
        ...config.leagues,
        { id: '', name: '', shortName: '', color: '#6366f1' },
      ],
    });
  }

  function removeLeague(index: number) {
    if (!config || config.leagues.length <= 1) return;
    const updated = config.leagues.filter((_, i) => i !== index);
    setConfig({ ...config, leagues: updated });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setMessage('');

    // Validate
    for (const league of config.leagues) {
      if (!league.id.trim() || !league.name.trim()) {
        setMessage('All leagues need an ID and name.');
        setSaving(false);
        return;
      }
    }

    const updatedConfig = { ...config, currentSeason: year };

    const res = await fetch('/api/admin/season', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, config: updatedConfig }),
    });

    if (res.ok) {
      setMessage('Saved! The site will use the new config on next page load.');
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error}`);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Season Management</h1>
        <p className="text-text-secondary text-sm mt-1">
          Update league IDs when new Sleeper leagues are created for the new season.
        </p>
      </div>

      {/* Season year */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="font-bold text-white">Season</h2>
        <div>
          <label className="text-sm text-text-secondary block mb-1">Season Year</label>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-32 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white focus:outline-none focus:border-primary stat"
          />
        </div>
      </div>

      {/* Leagues */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Leagues</h2>
          <button
            onClick={addLeague}
            className="text-sm text-primary hover:text-primary-dark transition-colors"
          >
            + Add League
          </button>
        </div>

        {config.leagues.map((league, i) => (
          <div key={i} className="p-4 rounded-lg bg-bg-tertiary space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: league.color }}
                />
                <span className="text-sm font-semibold text-white">
                  {league.name || 'New League'}
                </span>
              </div>
              {config.leagues.length > 1 && (
                <button
                  onClick={() => removeLeague(i)}
                  className="text-xs text-accent-red hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">League Name</label>
                <input
                  type="text"
                  value={league.name}
                  onChange={(e) => updateLeague(i, 'name', e.target.value)}
                  placeholder="Sales"
                  className="w-full px-3 py-1.5 rounded bg-bg-secondary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Short Name</label>
                <input
                  type="text"
                  value={league.shortName}
                  onChange={(e) => updateLeague(i, 'shortName', e.target.value)}
                  placeholder="Sales"
                  className="w-full px-3 py-1.5 rounded bg-bg-secondary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">
                Sleeper League ID
                <span className="text-text-muted ml-1">(from the league URL on Sleeper)</span>
              </label>
              <input
                type="text"
                value={league.id}
                onChange={(e) => updateLeague(i, 'id', e.target.value)}
                placeholder="1260755589445718016"
                className="w-full px-3 py-1.5 rounded bg-bg-secondary border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">Badge Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={league.color}
                  onChange={(e) => updateLeague(i, 'color', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs text-text-muted font-mono">{league.color}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Championship settings */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="font-bold text-white">Championship</h2>
        <div>
          <label className="text-sm text-text-secondary block mb-1">Qualifiers per League</label>
          <input
            type="number"
            min={1}
            max={10}
            value={config.championship.qualifiersPerLeague}
            onChange={(e) =>
              setConfig({
                ...config,
                championship: {
                  ...config.championship,
                  qualifiersPerLeague: parseInt(e.target.value) || 3,
                },
              })
            }
            className="w-20 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white focus:outline-none focus:border-primary stat"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
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
