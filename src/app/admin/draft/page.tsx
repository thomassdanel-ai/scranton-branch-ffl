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

export default function DraftPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [season, setSeason] = useState<Season | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [boards, setBoards] = useState<DraftBoard[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSeasons, setMemberSeasons] = useState<MemberSeason[]>([]);

  // Active board view
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
    setMembers(data.members || []);
    setMemberSeasons(data.memberSeasons || []);
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

  // Auto-refresh board every 10s when viewing a board linked to Sleeper
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

  const posColor: Record<string, string> = {
    QB: 'text-red-400',
    RB: 'text-green-400',
    WR: 'text-blue-400',
    TE: 'text-yellow-400',
    K: 'text-purple-400',
    DEF: 'text-orange-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading draft boards...</p>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="space-y-4">
        <Link href="/admin" className="text-primary text-sm hover:underline">&larr; Back</Link>
        <div className="glass-card p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">No Active Draft</h2>
          <p className="text-text-muted">Complete the Season Setup Wizard through Step 4 (Draft Order Lock) to generate draft boards.</p>
          <Link href="/admin/season-setup" className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors">
            Go to Season Setup
          </Link>
        </div>
      </div>
    );
  }

  // Board detail view
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
      <div className="space-y-4">
        <button onClick={() => { setActiveBoard(null); fetchOverview(); }} className="text-primary text-sm hover:underline">
          &larr; Back to All Boards
        </button>

        {error && <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}
        {success && <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2 text-green-300 text-sm">{success}</div>}

        {/* Header */}
        <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-white">
              {getLeagueName(activeBoard.league_id)} Draft
              {activeBoard.is_mock && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">MOCK</span>}
              {isSleeperLinked && <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">SLEEPER SYNC</span>}
            </h1>
            <p className="text-text-muted text-sm">
              Season {season.season_number} &middot; {madeCount}/{totalPicks} picks
              {isComplete && <span className="ml-2 text-accent-green font-semibold">Complete</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSleeperLinked && (
              <>
                <span className="text-text-muted text-xs">
                  Synced: {timeAgo(activeBoard.last_synced_at)}
                </span>
                <button
                  onClick={() => triggerSync(activeBoard.id)}
                  disabled={syncing}
                  className="px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </>
            )}
            {!isSleeperLinked && isPending && (
              <button onClick={() => boardAction(activeBoard.id, 'start')} disabled={submitting}
                className="px-4 py-2 bg-accent-green text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50">
                Start Draft
              </button>
            )}
            {!isSleeperLinked && isDrafting && (
              <button onClick={() => boardAction(activeBoard.id, 'pause')} disabled={submitting}
                className="px-3 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg text-sm font-semibold hover:bg-yellow-500/30 transition-colors disabled:opacity-50">
                Pause
              </button>
            )}
            {!isSleeperLinked && isPaused && (
              <button onClick={() => boardAction(activeBoard.id, 'resume')} disabled={submitting}
                className="px-3 py-2 bg-accent-green/20 text-accent-green rounded-lg text-sm font-semibold hover:bg-accent-green/30 transition-colors disabled:opacity-50">
                Resume
              </button>
            )}
            {(isDrafting || isPaused) && (
              <button onClick={() => boardAction(activeBoard.id, 'complete')} disabled={submitting}
                className="px-3 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50">
                End Draft
              </button>
            )}
            {activeBoard.is_mock && (isPending || isComplete) && (
              <button onClick={async () => { await boardAction(activeBoard.id, 'reset-mock'); await fetchBoard(activeBoard.id); }} disabled={submitting}
                className="px-3 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors disabled:opacity-50">
                Reset Mock
              </button>
            )}
          </div>
        </div>

        {/* Current pick info (when drafting and not yet complete) */}
        {(isDrafting || isPaused) && currentPickObj && (
          <div className="glass-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-text-muted text-xs uppercase tracking-wider">On the Clock</p>
                <p className="text-2xl font-extrabold text-white">{currentDrafter}</p>
                <p className="text-text-muted text-sm">
                  Round {activeBoard.current_round}, Pick {activeBoard.current_pick} &middot; Overall #{currentPickObj.overall_pick}
                </p>
              </div>
              {isSleeperLinked && (
                <div className="text-right">
                  <p className="text-text-muted text-xs">Picks sync automatically from Sleeper</p>
                  <p className="text-text-muted text-xs">every 2 minutes via cron</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Draft Grid */}
        <div className="glass-card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-text-muted py-2 px-2 w-16">Rd</th>
                {sortedMS.map((ms) => (
                  <th key={ms.id} className="text-center text-text-muted py-2 px-1 min-w-[110px]">
                    <span className="text-white font-semibold">{getMemberName(ms.id)}</span>
                    <br />
                    <span className="text-xs">#{ms.draft_position}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: activeBoard.num_rounds }, (_, r) => r + 1).map((round) => {
                const isEven = round % 2 === 0;
                const colOrder = isEven ? [...sortedMS].reverse() : sortedMS;
                return (
                  <tr key={round} className="border-b border-white/5">
                    <td className="text-text-muted py-2 px-2 font-mono text-xs">{round}</td>
                    {sortedMS.map((ms) => {
                      const colIdx = colOrder.findIndex((c) => c.id === ms.id);
                      const pick = picks.find((p) => p.round === round && p.pick_in_round === colIdx + 1);
                      const isCurrent = pick && activeBoard.current_round === round && activeBoard.current_pick === colIdx + 1 && (isDrafting || isPaused);

                      return (
                        <td key={ms.id} className={`text-center py-1.5 px-1 ${isCurrent ? 'bg-primary/20 ring-1 ring-primary rounded' : ''}`}>
                          {pick?.player_name ? (
                            <div>
                              <p className="text-white text-xs font-semibold truncate">{pick.player_name}</p>
                              <p className={`text-xs ${posColor[pick.position || ''] || 'text-text-muted'}`}>{pick.position}</p>
                            </div>
                          ) : (
                            <span className="text-text-muted/30 text-xs">#{pick?.overall_pick}</span>
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
        <div className="glass-card p-4">
          <h3 className="text-white font-bold mb-2">Recent Picks</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {picks.filter((p) => p.player_name).reverse().slice(0, 20).map((pick) => (
              <div key={pick.id} className="flex items-center gap-2 text-sm">
                <span className="text-text-muted font-mono text-xs w-8">#{pick.overall_pick}</span>
                <span className="text-white">{getMemberName(pick.member_season_id)}</span>
                <span className="text-text-muted">&rarr;</span>
                <span className={`font-semibold ${posColor[pick.position || ''] || 'text-white'}`}>
                  {pick.player_name}
                </span>
                <span className="text-text-muted text-xs">({pick.position})</span>
              </div>
            ))}
            {picks.filter((p) => p.player_name).length === 0 && (
              <p className="text-text-muted text-sm">No picks yet</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Overview: all boards for the drafting season
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-primary text-sm hover:underline">&larr; Back</Link>

      {error && <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}
      {success && <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2 text-green-300 text-sm">{success}</div>}

      <div>
        <h1 className="text-2xl font-extrabold text-white">Draft Board</h1>
        <p className="text-text-muted text-sm">Season {season.season_number} ({season.year})</p>
      </div>

      {/* League Draft Boards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {leagues.map((league) => {
          const realBoard = boards.find((b) => b.league_id === league.id && !b.is_mock);
          const mockBoard = boards.find((b) => b.league_id === league.id && b.is_mock);

          const statusColors: Record<string, string> = {
            pending: 'bg-yellow-500/20 text-yellow-300',
            drafting: 'bg-green-500/20 text-green-300',
            paused: 'bg-orange-500/20 text-orange-300',
            completed: 'bg-blue-500/20 text-blue-300',
          };

          return (
            <div key={league.id} className="glass-card p-5 space-y-3">
              <h2 className="font-bold text-white text-lg">{league.name}</h2>

              {/* Real Draft */}
              {realBoard ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[realBoard.status] || 'bg-white/10 text-white'}`}>
                      {realBoard.status.toUpperCase()}
                    </span>
                    {realBoard.sleeper_draft_id && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        SLEEPER
                      </span>
                    )}
                    {realBoard.status !== 'pending' && (
                      <span className="text-text-muted text-xs">
                        R{realBoard.current_round} P{realBoard.current_pick}
                      </span>
                    )}
                    {realBoard.last_synced_at && (
                      <span className="text-text-muted text-xs">
                        Synced {timeAgo(realBoard.last_synced_at)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => fetchBoard(realBoard.id)}
                    className="w-full px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors"
                  >
                    {realBoard.status === 'pending' ? 'Open Draft Board' : realBoard.status === 'completed' ? 'View Results' : 'View Draft'}
                  </button>
                </div>
              ) : (
                <p className="text-text-muted text-sm">No draft board generated. Lock draft order in Setup Wizard.</p>
              )}

              {/* Mock Draft */}
              <div className="border-t border-white/10 pt-3">
                {mockBoard ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[mockBoard.status] || 'bg-white/10 text-white'}`}>
                      MOCK: {mockBoard.status.toUpperCase()}
                    </span>
                    <button
                      onClick={() => fetchBoard(mockBoard.id)}
                      className="text-xs text-purple-300 hover:underline"
                    >
                      Open Mock
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => createMockDraft(league.id, season.id)}
                    disabled={submitting}
                    className="text-xs text-purple-300 hover:underline disabled:opacity-50"
                  >
                    Create Mock Draft
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Public Draft Link */}
      {boards.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-white font-bold mb-2">Share Draft Link</h3>
          <p className="text-text-muted text-sm mb-2">Send this link to league members so they can watch the draft live:</p>
          {boards.filter((b) => !b.is_mock).map((b) => (
            <div key={b.id} className="flex items-center gap-2 mb-1">
              <span className="text-white text-sm">{getLeagueName(b.league_id)}:</span>
              <code className="text-xs text-primary bg-bg-tertiary px-2 py-1 rounded">/draft/{b.id}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
