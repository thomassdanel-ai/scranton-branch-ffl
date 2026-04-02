'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Season, League, Member, MemberSeason, DraftBoard, FlashFn } from '../page';

type SleeperRosterInfo = {
  roster_id: string;
  display_name: string;
  team_name: string | null;
};

type Props = {
  season: Season;
  leagues: League[];
  members: Member[];
  memberSeasons: MemberSeason[];
  draftBoards: DraftBoard[];
  flash: FlashFn;
  onComplete: () => Promise<void>;
};

export default function Step6SleeperLinking({
  season,
  leagues,
  members,
  memberSeasons,
  draftBoards,
  flash,
  onComplete,
}: Props) {
  const [sleeperLinks, setSleeperLinks] = useState<Record<string, string>>({});
  const [sleeperRosters, setSleeperRosters] = useState<Record<string, SleeperRosterInfo[]>>({});
  const [rosterMappings, setRosterMappings] = useState<Record<string, { sleeper_roster_id: string; sleeper_display_name: string }>>({});
  const [sleeperDraftIds, setSleeperDraftIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [validatingDraft, setValidatingDraft] = useState<string | null>(null);

  // Initialize from existing data
  useEffect(() => {
    const links: Record<string, string> = {};
    for (const l of leagues) {
      if (l.sleeper_league_id) links[l.id] = l.sleeper_league_id;
    }
    setSleeperLinks(links);

    const draftIds: Record<string, string> = {};
    for (const b of draftBoards) {
      if (b.sleeper_draft_id) draftIds[b.league_id] = b.sleeper_draft_id;
    }
    setSleeperDraftIds(draftIds);

    const mappings: Record<string, { sleeper_roster_id: string; sleeper_display_name: string }> = {};
    for (const ms of memberSeasons) {
      if (ms.sleeper_roster_id) {
        mappings[ms.id] = {
          sleeper_roster_id: ms.sleeper_roster_id,
          sleeper_display_name: ms.sleeper_display_name || '',
        };
      }
    }
    setRosterMappings(mappings);
  }, [leagues, draftBoards, memberSeasons]);

  function getMemberName(memberId: string): string {
    const m = members.find((x) => x.id === memberId);
    return m?.display_name || m?.full_name || 'Unknown';
  }

  async function fetchSleeperRosters(leagueId: string, sleeperId: string) {
    const res = await fetch(`/api/admin/setup/sleeper?sleeper_league_id=${sleeperId}`);
    if (!res.ok) {
      flash('Failed to fetch Sleeper rosters', 'error');
      return;
    }
    const data = await res.json();
    setSleeperRosters((prev) => ({ ...prev, [leagueId]: data.rosters }));
  }

  async function saveSleeper() {
    setSaving(true);
    const res = await fetch('/api/admin/setup/sleeper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season.id, leagueLinks: sleeperLinks, rosterMappings }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Save failed', 'error');
    } else {
      flash('Sleeper links saved', 'success');
      await onComplete();
    }
    setSaving(false);
  }

  async function linkDraft(leagueId: string) {
    const draftId = sleeperDraftIds[leagueId];
    if (!draftId) return;

    setValidatingDraft(leagueId);

    const board = draftBoards.find((b) => b.league_id === leagueId);
    if (!board) {
      flash('Draft board not found for this league', 'error');
      setValidatingDraft(null);
      return;
    }

    const res = await fetch('/api/admin/draft/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId: board.id, action: 'link-sleeper', sleeperDraftId: draftId }),
    });

    if (!res.ok) {
      flash('Failed to link Sleeper draft', 'error');
    } else {
      flash(`Sleeper draft linked for ${leagues.find((l) => l.id === leagueId)?.name}`, 'success');
      await onComplete();
    }
    setValidatingDraft(null);
  }

  function getLeagueStatus(leagueId: string) {
    const league = leagues.find((l) => l.id === leagueId);
    const hasSleeperLeague = !!league?.sleeper_league_id;
    const leagueMS = memberSeasons.filter((ms) => ms.league_id === leagueId);
    const unmappedCount = leagueMS.filter((ms) => !ms.sleeper_roster_id).length;
    const allRostersMapped = leagueMS.length > 0 && unmappedCount === 0;
    const board = draftBoards.find((b) => b.league_id === leagueId);
    const hasDraftLink = !!board?.sleeper_draft_id;
    return { hasSleeperLeague, allRostersMapped, unmappedCount, hasDraftLink };
  }

  const allLeaguesComplete = leagues.every((l) => {
    const s = getLeagueStatus(l.id);
    return s.hasSleeperLeague && s.allRostersMapped && s.hasDraftLink;
  });

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-bold text-white">Step 6: Link Sleeper Leagues</h2>
      <p className="text-text-muted text-sm">
        Connect each league to its Sleeper league, map rosters, and link drafts.
      </p>

      {leagues.map((league) => {
        const status = getLeagueStatus(league.id);
        const board = draftBoards.find((b) => b.league_id === league.id);

        return (
          <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: league.color }} />
                <h3 className="font-bold text-white">{league.name}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={status.hasSleeperLeague ? 'text-green-300' : 'text-text-muted'}>
                  {status.hasSleeperLeague ? '\u2713' : '\u25cb'} League ID
                </span>
                <span className={status.allRostersMapped ? 'text-green-300' : 'text-text-muted'}>
                  {status.allRostersMapped ? '\u2713' : '\u25cb'} Rosters
                  {!status.allRostersMapped && status.unmappedCount > 0 && ` (${status.unmappedCount} unmapped)`}
                </span>
                <span className={status.hasDraftLink ? 'text-green-300' : 'text-text-muted'}>
                  {status.hasDraftLink ? '\u2713' : '\u25cb'} Draft
                </span>
              </div>
            </div>

            {/* Sleeper League ID input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={sleeperLinks[league.id] || ''}
                onChange={(e) => {
                  let val = e.target.value.trim();
                  const urlMatch = val.match(/sleeper\.com\/leagues\/(\d+)/);
                  if (urlMatch) val = urlMatch[1];
                  setSleeperLinks((prev) => ({ ...prev, [league.id]: val }));
                }}
                placeholder="Sleeper League URL or ID"
                className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  const sid = sleeperLinks[league.id];
                  if (sid) fetchSleeperRosters(league.id, sid);
                }}
                disabled={!sleeperLinks[league.id]}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
              >
                Fetch Rosters
              </button>
            </div>

            {/* Roster mapping */}
            {sleeperRosters[league.id] && (
              <div className="space-y-2">
                <p className="text-text-muted text-xs">Map each Sleeper roster to a member:</p>
                {memberSeasons
                  .filter((ms) => ms.league_id === league.id)
                  .map((ms) => (
                    <div key={ms.id} className="flex items-center gap-2">
                      <span className="text-text-secondary text-sm w-40 truncate">
                        {getMemberName(ms.member_id)}
                      </span>
                      <select
                        value={rosterMappings[ms.id]?.sleeper_roster_id || ''}
                        onChange={(e) => {
                          const roster = sleeperRosters[league.id].find((r) => r.roster_id === e.target.value);
                          if (roster) {
                            setRosterMappings((prev) => ({
                              ...prev,
                              [ms.id]: {
                                sleeper_roster_id: roster.roster_id,
                                sleeper_display_name: roster.display_name,
                              },
                            }));
                          }
                        }}
                        className="flex-1 px-2 py-1 rounded bg-bg-tertiary border border-white/10 text-white text-xs"
                      >
                        <option value="">Select roster...</option>
                        {sleeperRosters[league.id].map((r) => (
                          <option key={r.roster_id} value={r.roster_id}>
                            {r.display_name} {r.team_name ? `(${r.team_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            )}

            {/* Sleeper Draft ID */}
            {board && !board.sleeper_draft_id && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sleeperDraftIds[league.id] || ''}
                  onChange={(e) => setSleeperDraftIds((prev) => ({ ...prev, [league.id]: e.target.value.trim() }))}
                  placeholder="Sleeper Draft ID"
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => linkDraft(league.id)}
                  disabled={validatingDraft === league.id || !sleeperDraftIds[league.id]}
                  className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
                >
                  {validatingDraft === league.id ? 'Linking...' : 'Link Draft'}
                </button>
              </div>
            )}

            {board?.sleeper_draft_id && (
              <p className="text-xs text-green-300">Draft linked: {board.sleeper_draft_id}</p>
            )}

            {!board && (
              <p className="text-text-muted text-xs">No draft board found. Complete Step 5 first.</p>
            )}
          </div>
        );
      })}

      <button
        onClick={saveSleeper}
        disabled={saving || Object.keys(sleeperLinks).length === 0}
        className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save All Sleeper Links'}
      </button>

      {allLeaguesComplete && (
        <div className="p-4 rounded-lg bg-accent-green/10 border border-accent-green/30 text-center">
          <p className="text-accent-green text-lg font-bold">Season Setup Complete!</p>
          <p className="text-text-muted text-sm mt-1">All leagues are linked and ready to go.</p>
          <Link
            href="/admin"
            className="inline-block mt-3 px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
