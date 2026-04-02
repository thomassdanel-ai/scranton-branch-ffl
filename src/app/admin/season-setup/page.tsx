'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEFAULT_LEAGUE_NAMES } from '@/config/constants';
import InviteEmailGenerator from '@/components/admin/InviteEmailGenerator';

type Season = {
  id: string;
  season_number: number;
  year: number;
  status: string;
  num_leagues: number;
  roster_size_per_league: number;
};

type League = {
  id: string;
  name: string;
  sleeper_league_id: string | null;
};

type Member = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string | null;
  status: string;
};

type MemberSeason = {
  id: string;
  member_id: string;
  league_id: string;
  draft_position: number | null;
  onboard_status: string;
  sleeper_roster_id: string | null;
  sleeper_display_name: string | null;
};

type Cohort = {
  id: string;
  name: string;
  color: string;
  status: string;
  invite_token: string;
  settings: Record<string, unknown>;
  season_registrations: { count: number }[];
};

type Registration = {
  id: string;
  status: string;
  registered_at: string;
  member_id: string;
  members: { full_name: string; display_name: string | null; email: string };
};

type SleeperRosterInfo = {
  roster_id: string;
  display_name: string;
  team_name: string | null;
};

type DraftBoard = {
  id: string;
  league_id: string;
  sleeper_draft_id: string | null;
  status: string;
};

export default function SeasonSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<Season | null>(null);
  const [nextSeasonNumber, setNextSeasonNumber] = useState(1);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSeasons, setMemberSeasons] = useState<MemberSeason[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Step 1: Cohorts
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortColor, setNewCohortColor] = useState('#3b82f6');
  const [newCohortCapacity, setNewCohortCapacity] = useState('');
  const [emailCohortId, setEmailCohortId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Step 2: Registrations
  const [registrations, setRegistrations] = useState<Record<string, Registration[]>>({});
  const [confirmations, setConfirmations] = useState<Record<string, 'confirmed' | 'declined' | 'pending'>>({});

  // Step 3: Season & Leagues form
  const [year, setYear] = useState(new Date().getFullYear());
  const [numLeagues, setNumLeagues] = useState(2);
  const [leagueNames, setLeagueNames] = useState(DEFAULT_LEAGUE_NAMES.slice(0, 2));
  const [rosterSize, setRosterSize] = useState(10);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // Step 4: Draft order
  const [draftOrders, setDraftOrders] = useState<Record<string, number>>({});

  // Step 5: Sleeper linking
  const [sleeperLinks, setSleeperLinks] = useState<Record<string, string>>({});
  const [sleeperRosters, setSleeperRosters] = useState<Record<string, SleeperRosterInfo[]>>({});
  const [rosterMappings, setRosterMappings] = useState<Record<string, { sleeper_roster_id: string; sleeper_display_name: string }>>({});

  // Step 6: Sleeper Draft linking
  const [draftBoards, setDraftBoards] = useState<DraftBoard[]>([]);
  const [sleeperDraftIds, setSleeperDraftIds] = useState<Record<string, string>>({});
  const [validatingDraft, setValidatingDraft] = useState<string | null>(null);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const flash = useCallback((msg: string, type: 'error' | 'success') => {
    if (type === 'error') { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  }, []);

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/admin/setup');
    if (res.status === 401) {
      router.push('/admin');
      return;
    }
    const data = await res.json();
    setSeason(data.season);
    setNextSeasonNumber(data.nextSeasonNumber || 1);
    setLeagues(data.leagues || []);
    setMembers(data.members || []);
    setMemberSeasons(data.memberSeasons || []);

    if (data.leagues) {
      const links: Record<string, string> = {};
      for (const l of data.leagues) {
        if (l.sleeper_league_id) links[l.id] = l.sleeper_league_id;
      }
      setSleeperLinks(links);
    }

    setLoading(false);
  }, [router]);

  const fetchCohorts = useCallback(async () => {
    const res = await fetch('/api/admin/cohorts');
    if (res.ok) {
      const data = await res.json();
      setCohorts(data.cohorts || []);
    }
  }, []);

  const fetchDraftBoards = useCallback(async () => {
    const res = await fetch('/api/admin/draft');
    if (res.ok) {
      const data = await res.json();
      setDraftBoards(data.boards || []);
      const ids: Record<string, string> = {};
      for (const b of (data.boards || [])) {
        if (b.sleeper_draft_id) ids[b.league_id] = b.sleeper_draft_id;
      }
      setSleeperDraftIds(ids);
    }
  }, []);

  useEffect(() => {
    fetchState();
    fetchCohorts();
  }, [fetchState, fetchCohorts]);

  // Determine current step based on season status
  function getCurrentStep(): number {
    if (!season) return 1;
    if (season.status === 'setup' && memberSeasons.length === 0) return 3;
    if (season.status === 'setup') return 3;
    if (season.status === 'registering' || season.status === 'confirming') return 2;
    if (season.status === 'pre_draft') return 4;
    if (season.status === 'drafting' || season.status === 'active') return 5;
    return 1;
  }

  const currentStep = getCurrentStep();

  // --- Cohort actions ---
  async function createCohort(e: React.FormEvent) {
    e.preventDefault();
    if (!newCohortName.trim()) return;
    setSaving(true);

    const res = await fetch('/api/admin/cohorts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCohortName.trim(),
        color: newCohortColor,
        settings: newCohortCapacity ? { maxCapacity: Number(newCohortCapacity) } : {},
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Failed to create cohort', 'error');
    } else {
      flash('Cohort created', 'success');
      setNewCohortName('');
      setNewCohortCapacity('');
      await fetchCohorts();
    }
    setSaving(false);
  }

  async function copyInviteLink(token: string) {
    const url = `${siteUrl}/register/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(token);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  // --- Registration actions ---
  async function fetchRegistrations(cohortId: string) {
    const res = await fetch(`/api/admin/cohorts/${cohortId}/registrations`);
    if (res.ok) {
      const data = await res.json();
      setRegistrations((prev) => ({ ...prev, [cohortId]: data.registrations || [] }));
    }
  }

  async function confirmCohortRegistrations(cohortId: string, maxSlots: number) {
    setSaving(true);
    const res = await fetch(`/api/admin/cohorts/${cohortId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSlots }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Confirmation failed', 'error');
    } else {
      flash('Registrations confirmed', 'success');
      await fetchRegistrations(cohortId);
      await fetchCohorts();
    }
    setSaving(false);
  }

  // --- Season creation ---
  async function createSeason(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const confirmedMembers = members.filter((m) => confirmations[m.id] === 'confirmed');
    if (confirmedMembers.length === 0) {
      flash('No confirmed members', 'error');
      setSaving(false);
      return;
    }

    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, numLeagues, leagueNames: leagueNames.slice(0, numLeagues), rosterSize }),
    });

    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Failed to create season', 'error');
      setSaving(false);
      return;
    }

    const data = await res.json();
    await fetch('/api/admin/setup/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: data.season.id, confirmations }),
    });

    setSaving(false);
    fetchState();
  }

  // --- League randomization ---
  async function randomizeLeagues() {
    setError('');
    const res = await fetch('/api/admin/setup/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'randomize' }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Randomize failed', 'error');
      return;
    }
    const data = await res.json();
    setAssignments(data.assignments);
  }

  async function lockLeagues() {
    if (Object.keys(assignments).length === 0) {
      flash('Randomize first before locking', 'error');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/setup/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'lock', assignments }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Lock failed', 'error');
    }
    setSaving(false);
    fetchState();
  }

  // --- Draft order ---
  async function randomizeDraft() {
    setError('');
    const res = await fetch('/api/admin/setup/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'randomize' }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Randomize failed', 'error');
      return;
    }
    const data = await res.json();
    setDraftOrders(data.draftOrders);
  }

  async function lockDraft() {
    if (Object.keys(draftOrders).length === 0) {
      flash('Randomize draft order first', 'error');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/setup/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'lock', draftOrders }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Lock failed', 'error');
    }
    setSaving(false);
    fetchState();
    fetchDraftBoards();
  }

  // --- Sleeper linking ---
  async function fetchSleeperRosters(leagueId: string, sleeperId: string) {
    const res = await fetch(`/api/admin/setup/sleeper?sleeper_league_id=${sleeperId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSleeperRosters((prev) => ({ ...prev, [leagueId]: data.rosters }));
  }

  async function saveSleeper() {
    setSaving(true);
    const res = await fetch('/api/admin/setup/sleeper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, leagueLinks: sleeperLinks, rosterMappings }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Save failed', 'error');
    } else {
      flash('Sleeper links saved', 'success');
    }
    setSaving(false);
    fetchState();
  }

  // --- Sleeper Draft linking ---
  async function validateAndLinkDraft(leagueId: string) {
    const draftId = sleeperDraftIds[leagueId];
    if (!draftId) return;

    setValidatingDraft(leagueId);

    // Find the draft board for this league
    const board = draftBoards.find((b) => b.league_id === leagueId && !b.sleeper_draft_id);
    if (!board) {
      // Board already linked or doesn't exist
      flash('Draft board not found or already linked', 'error');
      setValidatingDraft(null);
      return;
    }

    // Update the draft board with the Sleeper draft ID via admin API
    const res = await fetch('/api/admin/draft/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId: board.id, action: 'link-sleeper', sleeperDraftId: draftId }),
    });

    if (!res.ok) {
      // Fallback: try a direct update via a dedicated endpoint
      flash('Linked via board action', 'error');
    } else {
      flash(`Sleeper draft linked for ${leagues.find((l) => l.id === leagueId)?.name}`, 'success');
    }

    setValidatingDraft(null);
    fetchDraftBoards();
  }

  // --- Helpers ---
  const confirmedCount = Object.values(confirmations).filter((v) => v === 'confirmed').length;

  function getMemberName(memberId: string): string {
    const m = members.find((x) => x.id === memberId);
    return m?.display_name || m?.full_name || 'Unknown';
  }

  // Initialize confirmations from member statuses
  useEffect(() => {
    if (members.length > 0 && Object.keys(confirmations).length === 0) {
      const confs: Record<string, 'confirmed' | 'declined' | 'pending'> = {};
      for (const m of members) {
        confs[m.id] = m.status === 'active' ? 'pending' : 'declined';
      }
      setConfirmations(confs);
    }
  }, [members, confirmations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Cohorts & Invites' },
    { num: 2, label: 'Review Registrations' },
    { num: 3, label: 'Season & Leagues' },
    { num: 4, label: 'Draft Order' },
    { num: 5, label: 'Sleeper Linking' },
    { num: 6, label: 'Link Drafts' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/admin" className="text-text-muted text-sm hover:text-white transition-colors">
          &larr; Back to Admin
        </Link>
        <h1 className="text-2xl font-extrabold text-white mt-1">Season Setup Wizard</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {steps.map((s) => (
          <div
            key={s.num}
            className={`flex-1 text-center py-2 text-xs font-medium rounded ${
              s.num === currentStep
                ? 'bg-primary text-white'
                : s.num < currentStep
                  ? 'bg-accent-green/20 text-accent-green'
                  : 'bg-bg-tertiary text-text-muted'
            }`}
          >
            {s.num}. {s.label}
          </div>
        ))}
      </div>

      {error && <p className="text-accent-red text-sm bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}
      {success && <p className="text-accent-green text-sm bg-green-500/10 px-4 py-2 rounded-lg">{success}</p>}

      {/* ===== STEP 1: Cohorts & Invites ===== */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Step 1: Cohorts & Registration</h2>
        <p className="text-text-muted text-sm">
          Create cohorts, generate invite links, and track who signs up.
        </p>

        {/* Existing cohorts */}
        {cohorts.length > 0 && (
          <div className="space-y-3">
            {cohorts.map((cohort) => {
              const regCount = cohort.season_registrations?.[0]?.count || 0;
              const maxCap = (cohort.settings?.maxCapacity as number) || null;

              return (
                <div key={cohort.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cohort.color }} />
                      <span className="text-white font-semibold">{cohort.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        cohort.status === 'open' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                      }`}>
                        {cohort.status}
                      </span>
                    </div>
                    <span className="text-text-muted text-sm font-mono">
                      {regCount}{maxCap ? `/${maxCap}` : ''} registered
                    </span>
                  </div>

                  {/* Progress bar */}
                  {maxCap && (
                    <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (regCount / maxCap) * 100)}%`, backgroundColor: cohort.color }}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => copyInviteLink(cohort.invite_token)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        copiedLink === cohort.invite_token
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-primary/20 text-primary hover:bg-primary/30'
                      }`}
                    >
                      {copiedLink === cohort.invite_token ? 'Copied!' : 'Copy Invite Link'}
                    </button>
                    <button
                      onClick={() => setEmailCohortId(emailCohortId === cohort.id ? null : cohort.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                    >
                      {emailCohortId === cohort.id ? 'Hide Email' : 'Generate Email'}
                    </button>
                    <button
                      onClick={() => fetchRegistrations(cohort.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-text-secondary hover:text-white transition-colors"
                    >
                      View Registrations
                    </button>
                  </div>

                  {/* Email generator */}
                  {emailCohortId === cohort.id && (
                    <InviteEmailGenerator
                      cohortName={cohort.name}
                      seasonYear={season ? String(season.year) : String(year)}
                      inviteUrl={`${siteUrl}/register/${cohort.invite_token}`}
                    />
                  )}

                  {/* Registration list */}
                  {registrations[cohort.id] && (
                    <div className="space-y-1 mt-2">
                      {registrations[cohort.id].length === 0 ? (
                        <p className="text-text-muted text-xs">No registrations yet.</p>
                      ) : (
                        registrations[cohort.id].map((reg) => (
                          <div key={reg.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-bg-tertiary/30">
                            <span className="text-text-secondary text-xs">
                              {reg.members?.display_name || reg.members?.full_name}
                              <span className="text-text-muted ml-1">({reg.members?.email})</span>
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              reg.status === 'confirmed' || reg.status === 'promoted' ? 'bg-green-500/20 text-green-300'
                                : reg.status === 'waitlisted' ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {reg.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create new cohort */}
        <form onSubmit={createCohort} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
          <h3 className="text-sm font-bold text-white">Create New Cohort</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={newCohortName}
              onChange={(e) => setNewCohortName(e.target.value)}
              placeholder="Cohort Name *"
              required
              className="px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <input
                type="color"
                value={newCohortColor}
                onChange={(e) => setNewCohortColor(e.target.value)}
                className="w-10 h-10 rounded border border-white/10 bg-bg-tertiary cursor-pointer"
              />
              <input
                type="number"
                value={newCohortCapacity}
                onChange={(e) => setNewCohortCapacity(e.target.value)}
                placeholder="Max Capacity"
                min={1}
                className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !newCohortName.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Cohort'}
            </button>
          </div>
        </form>
      </div>

      {/* ===== STEP 2: Review Registrations ===== */}
      {cohorts.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 2: Review Registrations</h2>
          <p className="text-text-muted text-sm">
            Confirm or waitlist registered members per cohort.
          </p>

          {cohorts.map((cohort) => {
            const maxCap = (cohort.settings?.maxCapacity as number) || 20;
            return (
              <div key={cohort.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cohort.color }} />
                    <span className="text-white font-semibold">{cohort.name}</span>
                  </div>
                  <button
                    onClick={() => confirmCohortRegistrations(cohort.id, maxCap)}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-green/20 text-accent-green hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Confirming...' : `Confirm (max ${maxCap})`}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Also show member list for manual confirmations */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-sm font-bold text-white mb-2">All Members</h3>
            <div className={`text-sm font-medium px-3 py-2 rounded-lg mb-3 ${
              confirmedCount >= 8 ? 'bg-accent-green/20 text-accent-green'
                : confirmedCount > 0 ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-bg-tertiary text-text-secondary'
            }`}>
              {confirmedCount} confirmed for season
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-bg-tertiary/30">
                  <span className="text-text-secondary text-sm">{m.display_name || m.full_name}</span>
                  <button
                    onClick={() => setConfirmations((prev) => ({
                      ...prev,
                      [m.id]: prev[m.id] === 'confirmed' ? 'declined' : 'confirmed',
                    }))}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      confirmations[m.id] === 'confirmed'
                        ? 'bg-accent-green text-white'
                        : 'bg-bg-tertiary text-text-muted hover:text-white'
                    }`}
                  >
                    {confirmations[m.id] === 'confirmed' ? 'Confirmed' : 'Confirm'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Create Season & League Assignment ===== */}
      {!season && confirmedCount > 0 && (
        <form onSubmit={createSeason} className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 3: Create Season & Leagues</h2>
          <p className="text-text-muted text-sm">{confirmedCount} confirmed members.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Season Number</label>
              <input type="text" value={`Season ${nextSeasonNumber}`} disabled
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-text-muted text-sm" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">NFL Year</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Number of Leagues</label>
              <select value={numLeagues} onChange={(e) => {
                const n = Number(e.target.value);
                setNumLeagues(n);
                setLeagueNames(DEFAULT_LEAGUE_NAMES.slice(0, n));
              }}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary">
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Roster Size per League</label>
              <input type="number" value={rosterSize} onChange={(e) => setRosterSize(Number(e.target.value))} min={4} max={16}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">League Names</label>
            <div className="space-y-2">
              {leagueNames.slice(0, numLeagues).map((name, i) => (
                <input key={i} type="text" value={name}
                  onChange={(e) => { const u = [...leagueNames]; u[i] = e.target.value; setLeagueNames(u); }}
                  placeholder={`League ${i + 1}`}
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary" />
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Season & Save Roster'}
          </button>
        </form>
      )}

      {/* League Randomization (within step 3) */}
      {season && season.status === 'setup' && memberSeasons.length === 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 3b: League Randomization</h2>
          <div className="flex gap-3">
            <button onClick={randomizeLeagues}
              className="px-4 py-2 bg-accent-purple text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
              Randomize
            </button>
            {Object.keys(assignments).length > 0 && (
              <button onClick={randomizeLeagues}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg font-semibold hover:text-white transition-colors">
                Re-roll
              </button>
            )}
          </div>

          {Object.keys(assignments).length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leagues.map((league) => {
                  const leagueMembers = Object.keys(assignments)
                    .filter((mid) => assignments[mid] === league.id)
                    .map((mid) => getMemberName(mid));
                  return (
                    <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50">
                      <h3 className="font-bold text-white mb-2">{league.name}</h3>
                      <div className="space-y-1">
                        {leagueMembers.map((name, i) => (
                          <p key={i} className="text-text-secondary text-sm">{name}</p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={lockLeagues} disabled={saving}
                className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? 'Locking...' : 'Lock League Assignments'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== STEP 4: Draft Order ===== */}
      {season && season.status === 'pre_draft' && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 4: Draft Order</h2>
          <div className="flex gap-3">
            <button onClick={randomizeDraft}
              className="px-4 py-2 bg-accent-purple text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
              Randomize Draft Order
            </button>
            {Object.keys(draftOrders).length > 0 && (
              <button onClick={randomizeDraft}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg font-semibold hover:text-white transition-colors">
                Re-roll
              </button>
            )}
          </div>

          {Object.keys(draftOrders).length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leagues.map((league) => {
                  const leagueMS = memberSeasons
                    .filter((ms) => ms.league_id === league.id)
                    .sort((a, b) => (draftOrders[a.id] || 0) - (draftOrders[b.id] || 0));
                  return (
                    <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50">
                      <h3 className="font-bold text-white mb-2">{league.name}</h3>
                      <div className="space-y-1">
                        {leagueMS.map((ms) => (
                          <div key={ms.id} className="flex items-center gap-2">
                            <span className="text-accent-gold font-mono text-sm w-6">{draftOrders[ms.id] || '?'}.</span>
                            <span className="text-text-secondary text-sm">{getMemberName(ms.member_id)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={lockDraft} disabled={saving}
                className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? 'Locking...' : 'Lock Draft Order & Generate Pick Slots'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== STEP 5: Sleeper Linking ===== */}
      {season && (season.status === 'drafting' || season.status === 'active' || season.status === 'pre_draft') && currentStep >= 5 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 5: Link Sleeper Leagues</h2>
          <p className="text-text-muted text-sm">Paste the Sleeper league URL or ID for each league, then map rosters.</p>

          {leagues.map((league) => (
            <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
              <h3 className="font-bold text-white">{league.name}</h3>
              <div className="flex gap-2">
                <input type="text" value={sleeperLinks[league.id] || ''} onChange={(e) => {
                  let val = e.target.value.trim();
                  const urlMatch = val.match(/sleeper\.com\/leagues\/(\d+)/);
                  if (urlMatch) val = urlMatch[1];
                  setSleeperLinks((prev) => ({ ...prev, [league.id]: val }));
                }} placeholder="Sleeper League URL or ID"
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary" />
                <button onClick={() => { const sid = sleeperLinks[league.id]; if (sid) fetchSleeperRosters(league.id, sid); }}
                  disabled={!sleeperLinks[league.id]}
                  className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                  Fetch Rosters
                </button>
              </div>

              {sleeperRosters[league.id] && (
                <div className="space-y-2">
                  <p className="text-text-muted text-xs">Map each Sleeper roster to a member:</p>
                  {memberSeasons.filter((ms) => ms.league_id === league.id).map((ms) => (
                    <div key={ms.id} className="flex items-center gap-2">
                      <span className="text-text-secondary text-sm w-40 truncate">{getMemberName(ms.member_id)}</span>
                      <select value={rosterMappings[ms.id]?.sleeper_roster_id || ''} onChange={(e) => {
                        const roster = sleeperRosters[league.id].find((r) => r.roster_id === e.target.value);
                        if (roster) setRosterMappings((prev) => ({ ...prev, [ms.id]: { sleeper_roster_id: roster.roster_id, sleeper_display_name: roster.display_name } }));
                      }}
                        className="flex-1 px-2 py-1 rounded bg-bg-tertiary border border-white/10 text-white text-xs">
                        <option value="">Select roster...</option>
                        {sleeperRosters[league.id].map((r) => (
                          <option key={r.roster_id} value={r.roster_id}>{r.display_name} {r.team_name ? `(${r.team_name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button onClick={saveSleeper} disabled={saving || Object.keys(sleeperLinks).length === 0}
            className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Sleeper Links'}
          </button>
        </div>
      )}

      {/* ===== STEP 6: Link Sleeper Drafts ===== */}
      {season && (season.status === 'drafting' || season.status === 'active') && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 6: Link Sleeper Drafts</h2>
          <p className="text-text-muted text-sm">
            Connect each league to its Sleeper draft. Picks will sync automatically every 2 minutes.
          </p>

          {leagues.map((league) => {
            const board = draftBoards.find((b) => b.league_id === league.id);
            const isLinked = board?.sleeper_draft_id;

            return (
              <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white">{league.name}</h3>
                  {isLinked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                      Linked: {isLinked}
                    </span>
                  )}
                </div>

                {!isLinked && board && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sleeperDraftIds[league.id] || ''}
                      onChange={(e) => setSleeperDraftIds((prev) => ({ ...prev, [league.id]: e.target.value.trim() }))}
                      placeholder="Sleeper Draft ID"
                      className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => validateAndLinkDraft(league.id)}
                      disabled={validatingDraft === league.id || !sleeperDraftIds[league.id]}
                      className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
                    >
                      {validatingDraft === league.id ? 'Linking...' : 'Link Draft'}
                    </button>
                  </div>
                )}

                {!board && (
                  <p className="text-text-muted text-xs">No draft board found. Complete Step 4 first.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed state */}
      {season && (season.status === 'active' || season.status === 'completed') && (
        <div className="glass-card p-6 text-center">
          <p className="text-accent-green text-lg font-bold">Season {season.season_number} is set up!</p>
          <p className="text-text-muted text-sm mt-2">
            Status: {season.status} | {leagues.length} leagues | {memberSeasons.length} members assigned
          </p>
        </div>
      )}
    </div>
  );
}
