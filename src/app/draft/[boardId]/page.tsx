'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

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
  member_season_id: string;
  round: number;
  pick_in_round: number;
  overall_pick: number;
  player_name: string | null;
  position: string | null;
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
  draft_position: number | null;
};

const posColor: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-purple-400',
  DEF: 'text-orange-400',
};

export default function PublicDraftBoard() {
  const params = useParams();
  const boardId = params.boardId as string;

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<DraftBoard | null>(null);
  const [leagueName, setLeagueName] = useState('');
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSeasons, setMemberSeasons] = useState<MemberSeason[]>([]);
  const [lastPick, setLastPick] = useState<string | null>(null);

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBoard = useCallback(async () => {
    const res = await fetch(`/api/draft?boardId=${boardId}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setBoard(data.board);
    setLeagueName(data.leagueName);
    setPicks(data.picks || []);
    setMembers(data.members || []);
    setMemberSeasons(data.memberSeasons || []);
    setLoading(false);

    if (data.board?.status === 'drafting' && !data.board?.sleeper_draft_id) {
      resetTimer(data.board.seconds_per_pick);
    }
  }, [boardId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Supabase Realtime: subscribe to draft_picks changes (both INSERT and UPDATE for Sleeper sync)
  useEffect(() => {
    if (!boardId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`draft-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_picks',
          filter: `draft_board_id=eq.${boardId}`,
        },
        (payload) => {
          const updated = payload.new as DraftPick;
          if (updated.player_name) {
            setPicks((prev) => {
              const exists = prev.find((p) => p.id === updated.id);
              if (exists) {
                return prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
              }
              return [...prev, updated].sort((a, b) => a.overall_pick - b.overall_pick);
            });
            setLastPick(updated.id);
            setTimeout(() => setLastPick(null), 3000);
          }
          fetchBoard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, fetchBoard]);

  // Poll board status every 10s as fallback
  useEffect(() => {
    const interval = setInterval(fetchBoard, 10000);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  function resetTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerSeconds(seconds);
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function getMemberName(memberSeasonId: string): string {
    const ms = memberSeasons.find((m) => m.id === memberSeasonId);
    if (!ms) return 'Unknown';
    const member = members.find((m) => m.id === ms.member_id);
    if (!member) return 'Unknown';
    return member.display_name || member.full_name;
  }

  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function timeAgo(iso: string | null): string {
    if (!iso) return '';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Loading draft board...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Draft Not Found</h2>
          <p className="text-text-muted">This draft board doesn&apos;t exist or hasn&apos;t been created yet.</p>
          <Link href="/" className="inline-block mt-4 text-primary hover:underline text-sm">Back to Home</Link>
        </div>
      </div>
    );
  }

  const sortedMS = [...memberSeasons].sort((a, b) => (a.draft_position || 0) - (b.draft_position || 0));
  const isDrafting = board.status === 'drafting';
  const isPaused = board.status === 'paused';
  const isComplete = board.status === 'completed';
  const isPending = board.status === 'pending';
  const isSleeperLinked = !!board.sleeper_draft_id;

  const currentPickObj = picks.find(
    (p) => p.round === board.current_round && p.pick_in_round === board.current_pick
  );
  const currentDrafter = currentPickObj ? getMemberName(currentPickObj.member_season_id) : '';
  const madeCount = picks.filter((p) => p.player_name).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            {leagueName} Draft
            {board.is_mock && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">MOCK</span>}
          </h1>
          <p className="text-text-muted text-sm">
            {madeCount}/{picks.length} picks &middot;{' '}
            {isComplete ? (
              <span className="text-accent-green font-semibold">Draft Complete</span>
            ) : isPending ? (
              <span className="text-yellow-300">Waiting to Start</span>
            ) : isPaused ? (
              <span className="text-orange-300">Paused</span>
            ) : (
              <span className="text-accent-green">Live</span>
            )}
            {isSleeperLinked && board.last_synced_at && (
              <span className="ml-2 text-text-muted">
                &middot; Last synced {timeAgo(board.last_synced_at)}
              </span>
            )}
          </p>
        </div>

        {/* Timer (only for non-Sleeper drafts) */}
        {!isSleeperLinked && (isDrafting || isPaused) && (
          <div className="text-center">
            <p className={`text-4xl font-mono font-bold ${timerSeconds <= 10 ? 'text-red-400 animate-pulse' : timerSeconds <= 30 ? 'text-yellow-300' : 'text-white'}`}>
              {formatTimer(timerSeconds)}
            </p>
            {isPaused && <p className="text-yellow-300 text-xs">PAUSED</p>}
          </div>
        )}
      </div>

      {/* On the Clock */}
      {(isDrafting || isPaused) && currentPickObj && (
        <div className="glass-card p-4 border-l-4 border-primary">
          <p className="text-text-muted text-xs uppercase tracking-wider">On the Clock</p>
          <p className="text-2xl font-extrabold text-white">{currentDrafter}</p>
          <p className="text-text-muted text-sm">
            Round {board.current_round}, Pick {board.current_pick} &middot; Overall #{currentPickObj.overall_pick}
          </p>
        </div>
      )}

      {/* Pending state */}
      {isPending && (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Draft Starting Soon</h2>
          <p className="text-text-muted">
            {isSleeperLinked
              ? 'Waiting for the first pick on Sleeper. Picks will sync automatically.'
              : 'Waiting for the commissioner to start the draft. This page will update automatically.'}
          </p>
        </div>
      )}

      {/* Draft Grid */}
      {!isPending && (
        <div className="glass-card p-2 sm:p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-text-muted py-2 px-2 w-12 sticky left-0 bg-bg-secondary z-10">Rd</th>
                {sortedMS.map((ms) => (
                  <th key={ms.id} className="text-center text-text-muted py-2 px-1 min-w-[100px]">
                    <span className="text-white font-semibold text-xs sm:text-sm">{getMemberName(ms.id)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: board.num_rounds }, (_, r) => r + 1).map((round) => {
                const isEven = round % 2 === 0;
                const colOrder = isEven ? [...sortedMS].reverse() : sortedMS;
                return (
                  <tr key={round} className="border-b border-white/5">
                    <td className="text-text-muted py-1.5 px-2 font-mono text-xs sticky left-0 bg-bg-secondary z-10">{round}</td>
                    {sortedMS.map((ms) => {
                      const colIdx = colOrder.findIndex((c) => c.id === ms.id);
                      const pick = picks.find((p) => p.round === round && p.pick_in_round === colIdx + 1);
                      const isCurrent = pick && board.current_round === round && board.current_pick === colIdx + 1 && (isDrafting || isPaused);
                      const isNew = pick?.id === lastPick;

                      return (
                        <td key={ms.id} className={`text-center py-1 px-1 transition-all duration-300 ${
                          isCurrent ? 'bg-primary/20 ring-1 ring-primary rounded' :
                          isNew ? 'bg-accent-green/20 ring-1 ring-accent-green rounded' : ''
                        }`}>
                          {pick?.player_name ? (
                            <div>
                              <p className="text-white text-xs font-semibold truncate">{pick.player_name}</p>
                              <p className={`text-xs ${posColor[pick.position || ''] || 'text-text-muted'}`}>{pick.position}</p>
                            </div>
                          ) : (
                            <span className="text-text-muted/20 text-xs">#{pick?.overall_pick}</span>
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
      )}

      {/* Recent Picks Ticker */}
      {!isPending && madeCount > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-white font-bold mb-2 text-sm">Recent Picks</h3>
          <div className="flex flex-wrap gap-2">
            {picks.filter((p) => p.player_name).reverse().slice(0, 12).map((pick) => (
              <div key={pick.id} className={`px-3 py-1.5 rounded-lg bg-bg-tertiary text-xs transition-all duration-300 ${
                pick.id === lastPick ? 'ring-1 ring-accent-green bg-accent-green/10' : ''
              }`}>
                <span className="text-text-muted font-mono">#{pick.overall_pick}</span>{' '}
                <span className={`font-semibold ${posColor[pick.position || ''] || 'text-white'}`}>{pick.player_name}</span>{' '}
                <span className="text-text-muted">({getMemberName(pick.member_season_id)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed state */}
      {isComplete && (
        <div className="glass-card p-6 text-center">
          <p className="text-3xl mb-2">&#127942;</p>
          <h2 className="text-xl font-bold text-white mb-2">Draft Complete!</h2>
          <p className="text-text-muted">{madeCount} players drafted across {board.num_rounds} rounds.</p>
        </div>
      )}

      <div className="text-center">
        <Link href="/" className="text-text-muted hover:text-primary text-xs transition-colors">
          Scranton Branch FFL
        </Link>
      </div>
    </div>
  );
}
