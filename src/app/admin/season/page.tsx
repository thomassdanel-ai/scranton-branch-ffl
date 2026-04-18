'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

const WIZARD_MANAGED_STATUSES = ['setup', 'registering', 'confirming', 'pre_draft', 'drafting'];

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

export default function SeasonManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [config, setConfig] = useState<SeasonConfig | null>(null);
  const [year, setYear] = useState('');
  const [seasonStatus, setSeasonStatus] = useState<string | null>(null);
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);

  useEffect(() => {
    const fetchStatus = fetch('/api/admin/dashboard')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.season) {
          setSeasonStatus(data.season.status);
          setSeasonNumber(data.season.season_number);
        }
      })
      .catch(() => {});

    const fetchConfig = fetch('/api/admin/season')
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
      });

    Promise.all([fetchStatus, fetchConfig]).finally(() => setLoading(false));
  }, [router]);

  const isWizardManaged = seasonStatus !== null && WIZARD_MANAGED_STATUSES.includes(seasonStatus);

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

    for (const league of config.leagues) {
      if (!league.id.trim() || !league.name.trim()) {
        setMessage('Error: All leagues need an ID and name.');
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading&hellip;</p>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="col col--lg" style={{ maxWidth: 800 }}>
      <div className="page-head">
        <h1 className="page-head__title">Season Management</h1>
        <p className="wiz-panel__sub" style={{ marginTop: 4 }}>
          Update league IDs when new Sleeper leagues are created for the new season.
        </p>
      </div>

      {isWizardManaged && (
        <div className="info-panel info-panel--warning">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Season {seasonNumber} is currently being set up.
          </div>
          <div style={{ color: 'var(--ink-7)' }}>
            Use the Setup Wizard to make changes during initial configuration.
          </div>
          <Link
            href="/admin/season-setup"
            style={{ color: 'var(--accent-live)', display: 'inline-block', marginTop: 8, fontSize: 13 }}
          >
            Go to Setup Wizard &rarr;
          </Link>
        </div>
      )}

      {/* Season year */}
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Season</h2>
        </div>
        <div>
          <label className="form-label">Season Year</label>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={isWizardManaged}
            className="inp inp--mono"
            style={{ width: 160 }}
          />
        </div>
      </div>

      {/* Leagues */}
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Leagues</h2>
          {!isWizardManaged && (
            <button onClick={addLeague} className="btn btn--sm">
              + Add League
            </button>
          )}
        </div>

        {config.leagues.map((league, i) => (
          <div key={i} className="subcard" style={cssVars({ '--dot-color': league.color })}>
            <div className="subcard__head">
              <div className="subcard__title">
                <span className="subcard__dot" />
                <span>{league.name || 'New League'}</span>
              </div>
              {config.leagues.length > 1 && !isWizardManaged && (
                <button onClick={() => removeLeague(i)} className="btn btn--sm btn--ghost" style={{ color: 'var(--accent-danger)' }}>
                  Remove
                </button>
              )}
            </div>

            <div className="form-grid form-grid--2">
              <div>
                <label className="form-label">League Name</label>
                <input
                  type="text"
                  value={league.name}
                  onChange={(e) => updateLeague(i, 'name', e.target.value)}
                  disabled={isWizardManaged}
                  placeholder="Sales"
                  className="inp"
                />
              </div>
              <div>
                <label className="form-label">Short Name</label>
                <input
                  type="text"
                  value={league.shortName}
                  onChange={(e) => updateLeague(i, 'shortName', e.target.value)}
                  disabled={isWizardManaged}
                  placeholder="Sales"
                  className="inp"
                />
              </div>
            </div>

            <div>
              <label className="form-label">
                Sleeper League ID
                <span style={{ color: 'var(--ink-5)', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                  (from the league URL on Sleeper)
                </span>
              </label>
              <input
                type="text"
                value={league.id}
                onChange={(e) => updateLeague(i, 'id', e.target.value)}
                disabled={isWizardManaged}
                placeholder="1260755589445718016"
                className="inp inp--mono"
              />
            </div>

            <div>
              <label className="form-label">Badge Color</label>
              <div className="row">
                <input
                  type="color"
                  value={league.color}
                  onChange={(e) => updateLeague(i, 'color', e.target.value)}
                  disabled={isWizardManaged}
                  className="inp-color"
                />
                <span style={{ color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {league.color}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Championship settings */}
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Championship</h2>
        </div>
        <div>
          <label className="form-label">Qualifiers per League</label>
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
            disabled={isWizardManaged}
            className="inp"
            style={{ width: 100 }}
          />
        </div>
      </div>

      {/* Save — hidden during wizard-managed setup */}
      {!isWizardManaged && (
        <div className="row">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn--primary btn--lg"
          >
            {saving ? 'Saving\u2026' : 'Save Configuration'}
          </button>
          {message && (
            <span
              className="form-hint"
              style={{
                color: message.startsWith('Error') ? 'var(--accent-danger)' : 'var(--accent-live)',
                fontSize: 13,
              }}
            >
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
