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

function statusChip(status: string): { cls: string; label: string } {
  if (status === 'completed') return { cls: 'chip chip--success', label: 'Complete' };
  if (status === 'drafting') return { cls: 'chip chip--live', label: 'Live' };
  if (status === 'paused') return { cls: 'chip chip--warning', label: 'Paused' };
  if (status === 'pending') return { cls: 'chip chip--warning', label: 'Waiting to Start' };
  return { cls: 'chip chip--muted', label: status };
}

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="loading-spin" />
          <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading draft board&hellip;</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="empty-state" style={{ maxWidth: 480 }}>
          <div className="empty-state__title">Draft Not Found</div>
          <div className="empty-state__body">This draft board doesn&apos;t exist or hasn&apos;t been created yet.</div>
          <Link href="/" className="action-link action-link--live" style={{ marginTop: 10 }}>
            Back to Home
          </Link>
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
  const chip = statusChip(board.status);

  const currentPickObj = picks.find(
    (p) => p.round === board.current_round && p.pick_in_round === board.current_pick
  );
  const currentDrafter = currentPickObj ? getMemberName(currentPickObj.member_season_id) : '';
  const madeCount = picks.filter((p) => p.player_name).length;

  const timerColor =
    timerSeconds <= 10 ? 'var(--accent-danger)' : timerSeconds <= 30 ? 'var(--accent-clock)' : 'var(--ink-8)';

  return (
    <div className="col col--lg" style={{ maxWidth: 1280, padding: '24px 16px' }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1 className="page-head__title" style={{ margin: 0 }}>
            {leagueName} Draft
          </h1>
          {board.is_mock && <span className="chip chip--warning">Mock</span>}
          <span className={chip.cls}>{chip.label}</span>
        </div>
        <p className="wiz-panel__sub" style={{ marginTop: 6 }}>
          {madeCount}/{picks.length} picks
          {isSleeperLinked && board.last_synced_at && (
            <> &middot; Last synced {timeAgo(board.last_synced_at)}</>
          )}
        </p>
      </div>

      {!isSleeperLinked && (isDrafting || isPaused) && (
        <div className="wiz-panel" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="label">Pick Timer</span>
            <span style={{ font: `700 40px / 1 var(--font-mono)`, color: timerColor }}>
              {formatTimer(timerSeconds)}
              {isPaused && <span style={{ marginLeft: 10, color: 'var(--accent-clock)', fontSize: 12 }}>PAUSED</span>}
            </span>
          </div>
        </div>
      )}

      {(isDrafting || isPaused) && currentPickObj && (
        <div className="on-clock">
          <div>
            <div className="on-clock__lab">On the Clock</div>
            <div className="on-clock__name">{currentDrafter}</div>
            <div className="on-clock__sub">
              Round {board.current_round}, Pick {board.current_pick} &middot; Overall #{currentPickObj.overall_pick}
            </div>
          </div>
        </div>
      )}

      {isPending && (
        <div className="empty-state" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="loading-spin loading-spin--lg" />
          <div className="empty-state__title" style={{ marginTop: 14 }}>Draft Starting Soon</div>
          <div className="empty-state__body">
            {isSleeperLinked
              ? 'Waiting for the first pick on Sleeper. Picks will sync automatically.'
              : 'Waiting for the commissioner to start the draft. This page will update automatically.'}
          </div>
        </div>
      )}

      {!isPending && (
        <div className="draft-board">
          <table>
            <thead>
              <tr>
                <th className="draft-board__round-lab">Rd</th>
                {sortedMS.map((ms) => (
                  <th key={ms.id} className="draft-board__member">
                    <span className="draft-board__member-name">{getMemberName(ms.id)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: board.num_rounds }, (_, r) => r + 1).map((round) => {
                const isEven = round % 2 === 0;
                const colOrder = isEven ? [...sortedMS].reverse() : sortedMS;
                return (
                  <tr key={round}>
                    <td className="draft-board__round-lab">{round}</td>
                    {sortedMS.map((ms) => {
                      const colIdx = colOrder.findIndex((c) => c.id === ms.id);
                      const pick = picks.find((p) => p.round === round && p.pick_in_round === colIdx + 1);
                      const isCurrent = pick && board.current_round === round && board.current_pick === colIdx + 1 && (isDrafting || isPaused);
                      const isNew = pick?.id === lastPick;
                      const cellClass = isCurrent || isNew ? 'draft-board__cell draft-board__cell--on' : 'draft-board__cell';
                      return (
                        <td key={ms.id} className={cellClass}>
                          {pick?.player_name ? (
                            <div>
                              <span className="draft-board__pick-name">{pick.player_name}</span>
                              <span className="draft-board__pick-pos pos-text" data-pos={pick.position || ''}>{pick.position}</span>
                            </div>
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
      )}

      {!isPending && madeCount > 0 && (
        <div className="wiz-panel">
          <div className="wiz-panel__head">
            <h2 className="wiz-panel__title">Recent Picks</h2>
          </div>
          <div className="pick-ticker">
            {picks.filter((p) => p.player_name).slice().reverse().slice(0, 12).map((pick) => (
              <div key={pick.id} className="pick-ticker__row">
                <span className="pick-ticker__num">#{pick.overall_pick}</span>
                <span className="pick-ticker__picker">{getMemberName(pick.member_season_id)}</span>
                <span className="pick-ticker__arrow">&rarr;</span>
                <span className="pick-ticker__player">{pick.player_name}</span>
                <span className="pick-ticker__pos pos-text" data-pos={pick.position || ''}>{pick.position}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isComplete && (
        <div className="empty-state" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>&#127942;</div>
          <div className="empty-state__title">Draft Complete!</div>
          <div className="empty-state__body">{madeCount} players drafted across {board.num_rounds} rounds.</div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Link href="/" style={{ color: 'var(--ink-5)', font: '500 var(--fs-12) / 1 var(--font-mono)' }}>
          Scranton Branch FFL
        </Link>
      </div>
    </div>
  );
}
