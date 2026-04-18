'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Season = {
  id: string;
  season_number: number;
  year: number;
  status: string;
};

type League = {
  id: string;
  name: string;
};

type DraftBoard = {
  id: string;
  league_id: string;
  season_id: string;
  status: string;
  num_rounds: number;
  current_round: number;
  current_pick: number;
  seconds_per_pick: number;
  is_mock: boolean;
  sleeper_draft_id: string | null;
  last_synced_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type DraftPick = {
  id: string;
  draft_board_id: string;
  member_season_id: string;
  round: number;
  pick_in_round: number;
  overall_pick: number;
  player_name: string | null;
  position: string | null;
  player_id: string | null;
  picked_at: string | null;
};

type Member = {
  id: string;
  full_name: string;
  display_name: string | null;
};

type MemberSeason = {
  id: string;
  member_id: string;
  league_id: string;
  draft_position: number | null;
};

function boardStatusChip(status: string): string {
  if (status === 'drafting') return 'chip chip--live';
  if (status === 'paused') return 'chip chip--warning';
  if (status === 'completed') return 'chip chip--info';
  if (status === 'pending') return 'chip chip--muted';
  return 'chip';
}

export default function DraftPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [season, setSeason] = useState<Season | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [boards, setBoards] = useState<DraftBoard[]>([]);

  const [activeBoard, setActiveBoard] = useState<DraftBoard | null>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [boardMembers, setBoardMembers] = useState<Member[]>([]);
  const [boardMemberSeasons, setBoardMemberSeasons] = useState<MemberSeason[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const flash = useCallback((msg: string, type: 'error' | 'success') => {
    if (type === 'error') { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  }, []);

  const fetchOverview = useCallback(async () => {
    const res = await fetch('/api/admin/draft');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setSeason(data.season);
    setLeagues(data.leagues || []);
    setBoards(data.boards || []);
    setLoading(false);
  }, []);

  const fetchBoard = useCallback(async (boardId: string) => {
    const res = await fetch(`/api/admin/draft/board?boardId=${boardId}`);
    if (!res.ok) {
      flash('Failed to load board', 'error');
      return;
    }
    const data = await res.json();
    setActiveBoard(data.board);
    setPicks(data.picks || []);
    setBoardMembers(data.members || []);
    setBoardMemberSeasons(data.memberSeasons || []);
  }, [flash]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (!activeBoard?.sleeper_draft_id) return;
    const interval = setInterval(() => fetchBoard(activeBoard.id), 10000);
    return () => clearInterval(interval);
  }, [activeBoard, fetchBoard]);

  async function boardAction(boardId: string, action: string) {
    setSubmitting(true);
    const res = await fetch('/api/admin/draft/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId, action }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      flash(data.error || 'Action failed', 'error');
      return;
    }
    flash(`Draft ${action}ed`, 'success');
    await fetchBoard(boardId);
  }

  async function triggerSync(boardId: string) {
    setSyncing(true);
    const res = await fetch('/api/admin/draft/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId }),
    });
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) {
      flash(data.error || 'Sync failed', 'error');
      return;
    }
    flash(`Synced ${data.synced} picks${data.completed ? ' — Draft complete!' : ''}`, 'success');
    await fetchBoard(boardId);
  }

  async function createMockDraft(leagueId: string, seasonId: string) {
    setSubmitting(true);
    const res = await fetch('/api/admin/draft/mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, seasonId }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      flash(data.error || 'Failed to create mock draft', 'error');
      return;
    }
    flash('Mock draft created', 'success');
    await fetchOverview();
  }

  function getMemberName(memberSeasonId: string): string {
    const ms = boardMemberSeasons.find((m) => m.id === memberSeasonId);
    if (!ms) return 'Unknown';
    const member = boardMembers.find((m) => m.id === ms.member_id);
    if (!member) return 'Unknown';
    return member.display_name || member.full_name;
  }

  function getLeagueName(leagueId: string): string {
    return leagues.find((l) => l.id === leagueId)?.name || 'Unknown';
  }

  function timeAgo(iso: string | null): string {
    if (!iso) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading draft boards&hellip;</p>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="col col--lg">
        <div className="page-head">
          <Link href="/admin" className="back-link">&larr; Back to Admin</Link>
        </div>
        <div className="empty-state">
          <h2 className="empty-state__title">No Active Draft</h2>
          <p className="empty-state__body">
            Complete the Season Setup Wizard through Step 5 (Draft Order Lock) to generate draft boards.
          </p>
          <Link href="/admin/season-setup" className="btn btn--primary btn--lg" style={{ marginTop: 8 }}>
            Go to Season Setup
          </Link>
        </div>
      </div>
    );
  }

  if (activeBoard) {
    const currentPickObj = picks.find(
      (p) => p.round === activeBoard.current_round && p.pick_in_round === activeBoard.current_pick
    );
    const currentDrafter = currentPickObj ? getMemberName(currentPickObj.member_season_id) : '';
    const totalPicks = picks.length;
    const madeCount = picks.filter((p) => p.player_name).length;
    const isDrafting = activeBoard.status === 'drafting';
    const isPaused = activeBoard.status === 'paused';
    const isComplete = activeBoard.status === 'completed';
    const isPending = activeBoard.status === 'pending';
    const isSleeperLinked = !!activeBoard.sleeper_draft_id;

    const sortedMS = [...boardMemberSeasons].sort((a, b) => (a.draft_position || 0) - (b.draft_position || 0));

    return (
      <div className="col col--lg">
        <div className="page-head">
          <button
            onClick={() => { setActiveBoard(null); fetchOverview(); }}
            className="back-link"
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          >
            &larr; Back to All Boards
          </button>
        </div>

        {error && <div className="flash flash--error">{error}</div>}
        {success && <div className="flash flash--success">{success}</div>}

        {/* Header */}
        <div className="wiz-panel">
          <div className="wiz-panel__head">
            <div>
              <h1 className="page-head__title" style={{ marginBottom: 4 }}>
                {getLeagueName(activeBoard.league_id)} Draft
              </h1>
              <div className="row">
                {activeBoard.is_mock && <span className="chip chip--warning">Mock</span>}
                {isSleeperLinked && <span className="chip chip--info">Sleeper Sync</span>}
                <span className={boardStatusChip(activeBoard.status)}>{activeBoard.status}</span>
              </div>
              <p className="wiz-panel__sub" style={{ marginTop: 8 }}>
                Season {season.season_number} &middot; {madeCount}/{totalPicks} picks
                {isComplete && <span style={{ color: 'var(--accent-live)', marginLeft: 8, fontWeight: 600 }}>Complete</span>}
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {isSleeperLinked && (
                <>
                  <span style={{ color: 'var(--ink-5)', font: '500 var(--fs-11) / 1 var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tr-wide)' }}>
                    Synced: {timeAgo(activeBoard.last_synced_at)}
                  </span>
                  <button onClick={() => triggerSync(activeBoard.id)} disabled={syncing} className="btn btn--sm">
                    {syncing ? 'Syncing\u2026' : 'Sync Now'}
                  </button>
                </>
              )}
              {!isSleeperLinked && isPending && (
                <button onClick={() => boardAction(activeBoard.id, 'start')} disabled={submitting} className="btn btn--primary btn--sm">
                  Start Draft
                </button>
              )}
              {!isSleeperLinked && isDrafting && (
                <button onClick={() => boardAction(activeBoard.id, 'pause')} disabled={submitting} className="btn btn--sm">
                  Pause
                </button>
              )}
              {!isSleeperLinked && isPaused && (
                <button onClick={() => boardAction(activeBoard.id, 'resume')} disabled={submitting} className="btn btn--sm">
                  Resume
                </button>
              )}
              {(isDrafting || isPaused) && (
                <button onClick={() => boardAction(activeBoard.id, 'complete')} disabled={submitting} className="btn btn--danger btn--sm">
                  End Draft
                </button>
              )}
              {activeBoard.is_mock && (isPending || isComplete) && (
                <button
                  onClick={async () => { await boardAction(activeBoard.id, 'reset-mock'); await fetchBoard(activeBoard.id); }}
                  disabled={submitting}
                  className="btn btn--sm"
                >
                  Reset Mock
                </button>
              )}
            </div>
          </div>
        </div>

        {/* On the clock */}
        {(isDrafting || isPaused) && currentPickObj && (
          <div className="on-clock">
            <div>
              <div className="on-clock__lab">On the Clock</div>
              <div className="on-clock__name">{currentDrafter}</div>
              <div className="on-clock__sub">
                Round {activeBoard.current_round}, Pick {activeBoard.current_pick} &middot; Overall #{currentPickObj.overall_pick}
              </div>
            </div>
            {isSleeperLinked && (
              <div className="on-clock__note">
                Picks sync automatically from Sleeper<br />
                every 2 minutes via cron
              </div>
            )}
          </div>
        )}

        {/* Draft Grid */}
        <div className="draft-board">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32, textAlign: 'center' }}>Rd</th>
                {sortedMS.map((ms) => (
                  <th key={ms.id} className="draft-board__member">
                    <span className="draft-board__member-name">{getMemberName(ms.id)}</span>
                    <span className="draft-board__member-seed">#{ms.draft_position}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: activeBoard.num_rounds }, (_, r) => r + 1).map((round) => {
                const isEven = round % 2 === 0;
                const colOrder = isEven ? [...sortedMS].reverse() : sortedMS;
                return (
                  <tr key={round}>
                    <td className="draft-board__round-lab">{round}</td>
                    {sortedMS.map((ms) => {
                      const colIdx = colOrder.findIndex((c) => c.id === ms.id);
                      const pick = picks.find((p) => p.round === round && p.pick_in_round === colIdx + 1);
                      const isCurrent = pick && activeBoard.current_round === round && activeBoard.current_pick === colIdx + 1 && (isDrafting || isPaused);

                      return (
                        <td
                          key={ms.id}
                          className={`draft-board__cell ${isCurrent ? 'draft-board__cell--on' : ''}`}
                        >
                          {pick?.player_name ? (
                            <>
                              <span className="draft-board__pick-name">{pick.player_name}</span>
                              <span
                                className="draft-board__pick-pos pos-text"
                                data-pos={pick.position || ''}
                              >
                                {pick.position}
                              </span>
                            </>
                          ) : (
                            <span className="draft-board__pick-pending">#{pick?.overall_pick}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recent Picks */}
        <div className="wiz-panel">
          <div className="wiz-panel__head">
            <h3 className="wiz-panel__title">Recent Picks</h3>
          </div>
          <div className="pick-ticker">
            {picks.filter((p) => p.player_name).reverse().slice(0, 20).map((pick) => (
              <div key={pick.id} className="pick-ticker__row">
                <span className="pick-ticker__num">#{pick.overall_pick}</span>
                <span className="pick-ticker__picker">{getMemberName(pick.member_season_id)}</span>
                <span className="pick-ticker__arrow">&rarr;</span>
                <span className="pick-ticker__player pos-text" data-pos={pick.position || ''}>
                  {pick.player_name}
                </span>
                <span className="pick-ticker__pos">({pick.position})</span>
              </div>
            ))}
            {picks.filter((p) => p.player_name).length === 0 && (
              <p className="form-hint">No picks yet</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Overview
  return (
    <div className="col col--lg">
      <div className="page-head">
        <Link href="/admin" className="back-link">&larr; Back to Admin</Link>
        <h1 className="page-head__title">Draft Board</h1>
        <p className="wiz-panel__sub" style={{ marginTop: 4 }}>Season {season.season_number} ({season.year})</p>
      </div>

      {error && <div className="flash flash--error">{error}</div>}
      {success && <div className="flash flash--success">{success}</div>}

      <div className="form-grid form-grid--2">
        {leagues.map((league) => {
          const realBoard = boards.find((b) => b.league_id === league.id && !b.is_mock);
          const mockBoard = boards.find((b) => b.league_id === league.id && b.is_mock);

          return (
            <div key={league.id} className="league-slot">
              <h2 className="league-slot__name">{league.name}</h2>

              {realBoard ? (
                <>
                  <div className="league-slot__meta">
                    <span className={boardStatusChip(realBoard.status)}>{realBoard.status}</span>
                    {realBoard.sleeper_draft_id && <span className="chip chip--info">Sleeper</span>}
                    {realBoard.status !== 'pending' && (
                      <span>R{realBoard.current_round} P{realBoard.current_pick}</span>
                    )}
                    {realBoard.last_synced_at && (
                      <span>Synced {timeAgo(realBoard.last_synced_at)}</span>
                    )}
                  </div>
                  <button onClick={() => fetchBoard(realBoard.id)} className="btn btn--primary">
                    {realBoard.status === 'pending' ? 'Open Draft Board' : realBoard.status === 'completed' ? 'View Results' : 'View Draft'}
                  </button>
                </>
              ) : (
                <p className="form-hint">No draft board generated. Lock draft order in Setup Wizard.</p>
              )}

              <div className="league-slot__mock">
                {mockBoard ? (
                  <>
                    <span className={boardStatusChip(mockBoard.status)}>Mock: {mockBoard.status}</span>
                    <button onClick={() => fetchBoard(mockBoard.id)} className="action-link action-link--live">
                      Open Mock
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => createMockDraft(league.id, season.id)}
                    disabled={submitting}
                    className="action-link action-link--live"
                  >
                    Create Mock Draft
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {boards.length > 0 && (
        <div className="wiz-panel">
          <div className="wiz-panel__head">
            <h3 className="wiz-panel__title">Share Draft Link</h3>
          </div>
          <p className="form-hint">Send this link to league members so they can watch the draft live:</p>
          <div className="col col--sm">
            {boards.filter((b) => !b.is_mock).map((b) => (
              <div key={b.id} className="share-link-row">
                <span className="share-link-row__lab">{getLeagueName(b.league_id)}:</span>
                <code className="code-badge">/draft/{b.id}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
