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

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

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
    <div className="wiz-panel">
      <div className="wiz-panel__head">
        <h2 className="wiz-panel__title">Step 6: Link Sleeper Leagues</h2>
      </div>
      <p className="wiz-panel__sub">
        Connect each league to its Sleeper league, map rosters, and link drafts.
      </p>

      {leagues.map((league) => {
        const status = getLeagueStatus(league.id);
        const board = draftBoards.find((b) => b.league_id === league.id);

        return (
          <div key={league.id} className="subcard" style={cssVars({ '--dot-color': league.color })}>
            <div className="subcard__head">
              <div className="subcard__title">
                <span className="subcard__dot" />
                <span>{league.name}</span>
              </div>
              <div className="status-dots">
                <span className={`status-dots__item ${status.hasSleeperLeague ? 'status-dots__item--on' : ''}`}>
                  League ID
                </span>
                <span className={`status-dots__item ${status.allRostersMapped ? 'status-dots__item--on' : ''}`}>
                  Rosters{!status.allRostersMapped && status.unmappedCount > 0 && ` (${status.unmappedCount})`}
                </span>
                <span className={`status-dots__item ${status.hasDraftLink ? 'status-dots__item--on' : ''}`}>
                  Draft
                </span>
              </div>
            </div>

            {/* Sleeper League ID input */}
            <div style={{ display: 'flex', gap: 8 }}>
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
                className="inp"
                style={{ flex: 1 }}
              />
              <button
                onClick={() => {
                  const sid = sleeperLinks[league.id];
                  if (sid) fetchSleeperRosters(league.id, sid);
                }}
                disabled={!sleeperLinks[league.id]}
                className="btn btn--primary"
              >
                Fetch Rosters
              </button>
            </div>

            {/* Roster mapping */}
            {sleeperRosters[league.id] && (
              <div className="col col--sm">
                <p className="form-hint">Map each Sleeper roster to a member:</p>
                {memberSeasons
                  .filter((ms) => ms.league_id === league.id)
                  .map((ms) => (
                    <div key={ms.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        className="reg-row__name"
                        style={{ width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
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
                        className="sel"
                        style={{ flex: 1, height: 28 }}
                      >
                        <option value="">Select roster&hellip;</option>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={sleeperDraftIds[league.id] || ''}
                  onChange={(e) => setSleeperDraftIds((prev) => ({ ...prev, [league.id]: e.target.value.trim() }))}
                  placeholder="Sleeper Draft ID"
                  className="inp"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => linkDraft(league.id)}
                  disabled={validatingDraft === league.id || !sleeperDraftIds[league.id]}
                  className="btn btn--primary"
                >
                  {validatingDraft === league.id ? 'Linking\u2026' : 'Link Draft'}
                </button>
              </div>
            )}

            {board?.sleeper_draft_id && (
              <p className="form-hint" style={{ color: 'var(--accent-live)' }}>Draft linked: {board.sleeper_draft_id}</p>
            )}

            {!board && (
              <p className="form-hint">No draft board found. Complete Step 5 first.</p>
            )}
          </div>
        );
      })}

      <button
        onClick={saveSleeper}
        disabled={saving || Object.keys(sleeperLinks).length === 0}
        className="btn btn--primary"
        style={{ alignSelf: 'flex-start' }}
      >
        {saving ? 'Saving\u2026' : 'Save All Sleeper Links'}
      </button>

      {allLeaguesComplete && (
        <div className="wiz-done">
          <p className="wiz-done__title">Season Setup Complete!</p>
          <p className="wiz-done__sub">All leagues are linked and ready to go.</p>
          <Link href="/admin" className="btn btn--primary btn--lg" style={{ marginTop: 8 }}>
            Go to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
