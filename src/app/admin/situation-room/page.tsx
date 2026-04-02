'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Season = {
  id: string;
  season_number: number;
  year: number;
  status: string;
};

type Draft = {
  boardId: string;
  leagueId: string;
  leagueName: string;
  leagueShortName: string;
  leagueColor: string;
  status: string;
  totalPicks: number;
  picksMade: number;
  currentPick: { round: number; pick: number; teamName: string } | null;
  recentPicks: { playerName: string; teamName: string; round: number; pick: number; timestamp: string; position: string }[];
  lastSyncedAt: string | null;
  sleeperLinked: boolean;
};

type ActivityItem = {
  playerName: string;
  teamName: string;
  round: number;
  pick: number;
  overall: number;
  position: string;
  timestamp: string;
  leagueName: string;
  leagueColor: string;
};

const posColor: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-purple-400',
  DEF: 'text-orange-400',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Not Started', color: 'bg-yellow-500/20 text-yellow-300' },
  drafting: { label: 'Active', color: 'bg-green-500/20 text-green-300' },
  paused: { label: 'Paused', color: 'bg-orange-500/20 text-orange-300' },
  completed: { label: 'Complete', color: 'bg-blue-500/20 text-blue-300' },
};

export default function SituationRoomPage() {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<Season | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/situation-room');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setSeason(data.season);
    setDrafts(data.drafts || []);
    setActivity(data.recentActivity || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Realtime: subscribe to all draft_picks changes
  useEffect(() => {
    if (drafts.length === 0) return;

    const supabase = createClient();
    const activeBoardIds = drafts
      .filter((d) => d.status === 'drafting' || d.status === 'paused')
      .map((d) => d.boardId);

    if (activeBoardIds.length === 0) return;

    const channels = activeBoardIds.map((boardId) =>
      supabase
        .channel(`situation-${boardId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'draft_picks',
            filter: `draft_board_id=eq.${boardId}`,
          },
          () => {
            fetchData();
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [drafts, fetchData]);

  function timeAgo(iso: string | null): string {
    if (!iso) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading situation room...</p>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="space-y-4">
        <Link href="/admin" className="text-primary text-sm hover:underline">&larr; Back</Link>
        <div className="glass-card p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">No Active Season</h2>
          <p className="text-text-muted">Start a season and set up drafts to use the Situation Room.</p>
        </div>
      </div>
    );
  }

  const activeDrafts = drafts.filter((d) => d.status === 'drafting' || d.status === 'paused');
  const totalPicks = drafts.reduce((a, d) => a + d.totalPicks, 0);
  const totalMade = drafts.reduce((a, d) => a + d.picksMade, 0);
  const globalProgress = totalPicks > 0 ? Math.round((totalMade / totalPicks) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-primary text-sm hover:underline">&larr; Back to Command Center</Link>

      {/* Top Bar */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Situation Room</h1>
            <p className="text-text-muted text-sm">
              Season {season.season_number} ({season.year}) &middot;{' '}
              {activeDrafts.length} of {drafts.length} drafts active &middot;{' '}
              {globalProgress}% complete
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-bg-tertiary rounded-full h-3">
              <div
                className="h-3 rounded-full bg-primary transition-all"
                style={{ width: `${globalProgress}%` }}
              />
            </div>
            <span className="text-white font-mono text-sm">{totalMade}/{totalPicks}</span>
          </div>
        </div>
      </div>

      {/* Draft Cards Grid */}
      {drafts.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <h2 className="text-lg font-bold text-white mb-2">No Draft Boards</h2>
          <p className="text-text-muted">Complete the draft setup in the Season Setup Wizard to create draft boards.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {drafts.map((draft) => {
            const progress = draft.totalPicks > 0 ? Math.round((draft.picksMade / draft.totalPicks) * 100) : 0;
            const cfg = statusConfig[draft.status] || { label: draft.status, color: 'bg-white/10 text-white' };

            return (
              <div key={draft.boardId} className="glass-card p-4 space-y-3" style={{ borderTop: `3px solid ${draft.leagueColor}` }}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold">{draft.leagueName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {draft.sleeperLinked && (
                    <span className="text-xs text-blue-300">Sleeper</span>
                  )}
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                      <path className="text-bg-tertiary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="currentColor" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke={draft.leagueColor} strokeWidth="3"
                        strokeDasharray={`${progress}, 100`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-mono font-bold">
                      {progress}%
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-mono text-sm">{draft.picksMade}/{draft.totalPicks} picks</p>
                    {draft.lastSyncedAt && (
                      <p className="text-text-muted text-xs">Synced {timeAgo(draft.lastSyncedAt)}</p>
                    )}
                  </div>
                </div>

                {/* Current Pick */}
                {draft.currentPick && (draft.status === 'drafting' || draft.status === 'paused') && (
                  <div className="bg-bg-tertiary/50 rounded-lg p-2">
                    <p className="text-text-muted text-xs">On the Clock</p>
                    <p className="text-white font-semibold text-sm">{draft.currentPick.teamName}</p>
                    <p className="text-text-muted text-xs">
                      Round {draft.currentPick.round}, Pick {draft.currentPick.pick}
                    </p>
                  </div>
                )}

                {/* Recent Picks */}
                {draft.recentPicks.length > 0 && (
                  <div className="space-y-1">
                    {draft.recentPicks.map((pick, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted font-mono w-10">R{pick.round}P{pick.pick}</span>
                        <span className={`font-semibold ${posColor[pick.position] || 'text-white'}`}>{pick.playerName}</span>
                        <span className="text-text-muted ml-auto">{pick.teamName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Link to full board */}
                <Link
                  href={`/admin/draft`}
                  className="block text-center text-xs text-primary hover:underline"
                >
                  Open Full Board
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Activity Feed */}
      {activity.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">All Draft Activity</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.leagueColor }} />
                <span className="text-text-muted text-xs font-mono w-8">#{item.overall}</span>
                <span className={`text-xs font-semibold ${posColor[item.position] || 'text-white'}`}>{item.playerName}</span>
                <span className="text-text-muted text-xs">{item.position}</span>
                <span className="text-text-muted text-xs ml-auto">{item.teamName}</span>
                <span className="text-text-muted text-xs">&middot;</span>
                <span className="text-text-muted text-xs">{item.leagueName}</span>
                <span className="text-text-muted text-xs">{timeAgo(item.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
