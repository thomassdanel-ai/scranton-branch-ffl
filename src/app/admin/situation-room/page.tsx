'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Season = {
  id: string;
  season_number: number;
  year: number;
  status: string;
};

type EnrollmentMember = {
  memberSeasonId: string;
  name: string;
  email: string;
  sleeperUsername: string | null;
  enrollmentStatus: string;
  inviteSentAt: string | null;
  reminderSentAt: string | null;
  sleeperRosterId: string | null;
};

type EnrollmentLeague = {
  leagueId: string;
  leagueName: string;
  leagueShortName: string;
  leagueColor: string;
  sleeperLeagueId: string | null;
  sleeperInviteLink: string | null;
  lastCheckAt: string | null;
  members: EnrollmentMember[];
};

type EnrollmentData = {
  leagues: EnrollmentLeague[];
  summary: { totalMembers: number; enrolled: number; invited: number; pending: number };
};

type TeamRoster = {
  memberSeasonId: string;
  teamName: string;
  picks: { round: number; pick: number; overall: number; playerName: string; position: string }[];
  positionCounts: Record<string, number>;
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
  numRounds: number;
  currentPick: { round: number; pick: number; teamName: string; memberSeasonId: string | null } | null;
  recentPicks: { playerName: string; teamName: string; round: number; pick: number; timestamp: string; position: string }[];
  lastSyncedAt: string | null;
  sleeperLinked: boolean;
  positionBreakdown: Record<string, number>;
  teamRosters: TeamRoster[];
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
  leagueShortName: string;
  leagueColor: string;
  boardId: string;
};

const posColor: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-purple-400',
  DEF: 'text-orange-400',
};

const posBgColor: Record<string, string> = {
  QB: 'bg-red-400',
  RB: 'bg-green-400',
  WR: 'bg-blue-400',
  TE: 'bg-yellow-400',
  K: 'bg-purple-400',
  DEF: 'bg-orange-400',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Not Started', color: 'bg-yellow-500/20 text-yellow-300' },
  drafting: { label: 'Active', color: 'bg-green-500/20 text-green-300' },
  paused: { label: 'Paused', color: 'bg-orange-500/20 text-orange-300' },
  completed: { label: 'Complete', color: 'bg-blue-500/20 text-blue-300' },
};

const ALL_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export default function SituationRoomPage() {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<Season | null>(null);
  const [phase, setPhase] = useState<string>('idle');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null);

  // Enrollment UI state
  const [linkInputs, setLinkInputs] = useState<Record<string, { leagueId: string; inviteLink: string }>>({});
  const [sendingInvites, setSendingInvites] = useState<Record<string, boolean>>({});
  const [checkingEnrollment, setCheckingEnrollment] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState<string | null>(null);

  // Filter state
  const [leagueFilters, setLeagueFilters] = useState<Set<string>>(new Set());
  const [positionFilters, setPositionFilters] = useState<Set<string>>(new Set(ALL_POSITIONS));
  const [roundFilter, setRoundFilter] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/situation-room');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setSeason(data.season);
    setPhase(data.phase || 'idle');
    setDrafts(data.drafts || []);
    setActivity(data.recentActivity || []);
    setEnrollment(data.enrollment || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize league filters once drafts are loaded
  useEffect(() => {
    if (drafts.length > 0 && leagueFilters.size === 0) {
      setLeagueFilters(new Set(drafts.map((d) => d.boardId)));
    }
  }, [drafts, leagueFilters.size]);

  // Auto-refresh: 30s for enrollment, 15s for drafting
  useEffect(() => {
    const interval = setInterval(fetchData, phase === 'enrollment' ? 30000 : 15000);
    return () => clearInterval(interval);
  }, [fetchData, phase]);

  // Realtime subscriptions
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
          { event: '*', schema: 'public', table: 'draft_picks', filter: `draft_board_id=eq.${boardId}` },
          () => { fetchData(); }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [drafts, fetchData]);

  // Compute stats
  const stats = useMemo(() => {
    if (activity.length === 0) return null;

    // Most drafted position
    const posCounts: Record<string, number> = {};
    for (const item of activity) {
      posCounts[item.position] = (posCounts[item.position] || 0) + 1;
    }
    const mostDrafted = Object.entries(posCounts).sort((a, b) => b[1] - a[1])[0];

    // Fastest league
    const leaguePicks: Record<string, { name: string; count: number }> = {};
    for (const d of drafts) {
      leaguePicks[d.boardId] = { name: d.leagueName, count: d.picksMade };
    }
    const fastest = Object.values(leaguePicks).sort((a, b) => b.count - a.count)[0];

    // Most recent pick
    const mostRecent = activity[0];

    // Picks this hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const picksThisHour = activity.filter((a) => a.timestamp && new Date(a.timestamp).getTime() > oneHourAgo).length;

    return { mostDrafted, fastest, mostRecent, picksThisHour };
  }, [activity, drafts]);

  // Filtered activity
  const filteredActivity = useMemo(() => {
    return activity.filter((item) => {
      if (!leagueFilters.has(item.boardId)) return false;
      if (!positionFilters.has(item.position)) return false;
      if (roundFilter !== null && item.round !== roundFilter) return false;
      return true;
    });
  }, [activity, leagueFilters, positionFilters, roundFilter]);

  // Max rounds across all drafts
  const maxRounds = useMemo(() => {
    return Math.max(...drafts.map((d) => d.numRounds), 0);
  }, [drafts]);

  function timeAgo(iso: string | null): string {
    if (!iso) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  function toggleLeagueFilter(boardId: string) {
    setLeagueFilters((prev) => {
      const next = new Set(prev);
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      return next;
    });
  }

  function togglePositionFilter(pos: string) {
    setPositionFilters((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos);
      else next.add(pos);
      return next;
    });
  }

  // Enrollment handlers
  async function handleLinkLeague(leagueId: string) {
    const input = linkInputs[leagueId];
    if (!input?.leagueId && !input?.inviteLink) return;
    const res = await fetch('/api/admin/enrollment/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, sleeperLeagueId: input.leagueId, sleeperInviteLink: input.inviteLink }),
    });
    if (res.ok) {
      setLinkInputs((prev) => ({ ...prev, [leagueId]: { leagueId: '', inviteLink: '' } }));
      fetchData();
    }
  }

  async function handleSendEmails(leagueId: string, type: 'invite' | 'reminder') {
    setSendingInvites((prev) => ({ ...prev, [leagueId]: true }));
    setEnrollmentMessage(null);
    const res = await fetch('/api/admin/enrollment/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, type }),
    });
    const data = await res.json();
    setSendingInvites((prev) => ({ ...prev, [leagueId]: false }));
    if (res.ok) {
      setEnrollmentMessage(`${type === 'invite' ? 'Invites' : 'Reminders'} sent: ${data.sent}${data.failed ? `, ${data.failed} failed` : ''}`);
      fetchData();
    }
  }

  async function handleCheckEnrollment(leagueId?: string) {
    if (!season) return;
    setCheckingEnrollment(true);
    setEnrollmentMessage(null);
    const res = await fetch('/api/admin/enrollment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season.id, leagueId }),
    });
    const data = await res.json();
    setCheckingEnrollment(false);
    if (res.ok && data.results) {
      const total = data.results.reduce((a: number, r: { newEnrollments: number }) => a + r.newEnrollments, 0);
      setEnrollmentMessage(total > 0 ? `Found ${total} new enrollment${total !== 1 ? 's' : ''}!` : 'No new enrollments detected');
      fetchData();
    }
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

  // ──────────────────────────────────────────────
  // ENROLLMENT PHASE
  // ──────────────────────────────────────────────
  if (phase === 'enrollment' && enrollment) {
    const { summary, leagues: enrollLeagues } = enrollment;
    const enrollProgress = summary.totalMembers > 0 ? Math.round((summary.enrolled / summary.totalMembers) * 100) : 0;
    const allEnrolled = summary.enrolled === summary.totalMembers && summary.totalMembers > 0;

    return (
      <div className="space-y-6">
        <Link href="/admin" className="text-primary text-sm hover:underline">&larr; Back to Command Center</Link>

        {/* Top Bar */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Situation Room</h1>
              <p className="text-text-muted text-sm">
                Season {season.season_number} ({season.year}) &middot; Enrollment Phase
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-white font-mono text-sm">{summary.enrolled}/{summary.totalMembers} enrolled</p>
                <p className="text-text-muted text-xs">{summary.invited} invited &middot; {summary.pending} pending</p>
              </div>
              <div className="w-24 bg-bg-tertiary rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-green-500 transition-all"
                  style={{ width: `${enrollProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status message */}
        {enrollmentMessage && (
          <div className="glass-card p-3 text-center">
            <p className="text-sm text-white">{enrollmentMessage}</p>
          </div>
        )}

        {/* All enrolled banner */}
        {allEnrolled && (
          <div className="glass-card p-4 text-center border border-green-500/30 bg-green-500/5">
            <p className="text-green-300 font-bold text-lg">All members enrolled!</p>
            <p className="text-text-muted text-sm mt-1">Everyone has joined their Sleeper league. Ready for draft setup.</p>
            <Link href="/admin/season-setup" className="inline-block mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors">
              Continue to Draft Setup
            </Link>
          </div>
        )}

        {/* Page-level actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCheckEnrollment()}
            disabled={checkingEnrollment}
            className="px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors disabled:opacity-50"
          >
            {checkingEnrollment ? 'Checking...' : 'Check All Leagues'}
          </button>
        </div>

        {/* League Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {enrollLeagues.map((league) => {
            const enrolled = league.members.filter((m) => m.enrollmentStatus === 'enrolled').length;
            const total = league.members.length;
            const progress = total > 0 ? Math.round((enrolled / total) * 100) : 0;
            const isLinked = !!league.sleeperLeagueId;
            const hasInviteLink = !!league.sleeperInviteLink;
            const input = linkInputs[league.leagueId] || { leagueId: '', inviteLink: '' };
            const isSending = sendingInvites[league.leagueId];
            const pendingInvites = league.members.filter((m) => !m.inviteSentAt).length;
            const pendingReminders = league.members.filter((m) => m.inviteSentAt && m.enrollmentStatus !== 'enrolled').length;

            return (
              <div key={league.leagueId} className="glass-card p-4 space-y-3" style={{ borderTop: `3px solid ${league.leagueColor}` }}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold">{league.leagueName}</h3>
                  {isLinked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Sleeper Linked</span>
                  )}
                </div>

                {/* Progress ring */}
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                      <path className="text-bg-tertiary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="currentColor" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke={league.leagueColor} strokeWidth="3"
                        strokeDasharray={`${progress}, 100`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-mono font-bold">
                      {progress}%
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-mono text-sm">{enrolled}/{total} enrolled</p>
                    {league.lastCheckAt && (
                      <p className="text-text-muted text-xs">Checked {timeAgo(league.lastCheckAt)}</p>
                    )}
                  </div>
                </div>

                {/* Link Sleeper league (if not linked) */}
                {!isLinked && (
                  <div className="space-y-2 p-3 rounded-lg bg-bg-tertiary/50">
                    <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Link to Sleeper</p>
                    <input
                      type="text"
                      value={input.leagueId}
                      onChange={(e) => setLinkInputs((prev) => ({ ...prev, [league.leagueId]: { ...input, leagueId: e.target.value } }))}
                      placeholder="Sleeper League ID or URL"
                      className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm placeholder-text-muted focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      value={input.inviteLink}
                      onChange={(e) => setLinkInputs((prev) => ({ ...prev, [league.leagueId]: { ...input, inviteLink: e.target.value } }))}
                      placeholder="Sleeper invite link (sleeper.com/i/...)"
                      className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm placeholder-text-muted focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => handleLinkLeague(league.leagueId)}
                      className="w-full px-3 py-1.5 bg-primary text-white rounded text-sm font-semibold hover:bg-primary-dark transition-colors"
                    >
                      Link League
                    </button>
                  </div>
                )}

                {/* Invite link input if linked but no invite link */}
                {isLinked && !hasInviteLink && (
                  <div className="space-y-2 p-3 rounded-lg bg-bg-tertiary/50">
                    <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Add Invite Link</p>
                    <input
                      type="text"
                      value={input.inviteLink}
                      onChange={(e) => setLinkInputs((prev) => ({ ...prev, [league.leagueId]: { ...input, inviteLink: e.target.value } }))}
                      placeholder="Sleeper invite link (sleeper.com/i/...)"
                      className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm placeholder-text-muted focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => handleLinkLeague(league.leagueId)}
                      className="w-full px-3 py-1.5 bg-primary text-white rounded text-sm font-semibold hover:bg-primary-dark transition-colors"
                    >
                      Save Link
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                {hasInviteLink && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSendEmails(league.leagueId, 'invite')}
                      disabled={isSending || pendingInvites === 0}
                      className="flex-1 px-3 py-1.5 bg-green-500/20 text-green-300 rounded text-xs font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-40"
                    >
                      {isSending ? 'Sending...' : `Send Invites (${pendingInvites})`}
                    </button>
                    <button
                      onClick={() => handleSendEmails(league.leagueId, 'reminder')}
                      disabled={isSending || pendingReminders === 0}
                      className="flex-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold hover:bg-yellow-500/30 transition-colors disabled:opacity-40"
                    >
                      Remind ({pendingReminders})
                    </button>
                    <button
                      onClick={() => handleCheckEnrollment(league.leagueId)}
                      disabled={checkingEnrollment}
                      className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold hover:bg-blue-500/30 transition-colors disabled:opacity-40"
                    >
                      Check
                    </button>
                  </div>
                )}

                {/* Member list */}
                <div className="space-y-1">
                  {league.members.map((member) => {
                    const statusDot = member.enrollmentStatus === 'enrolled'
                      ? 'bg-green-400' : member.enrollmentStatus === 'invited'
                      ? 'bg-yellow-400' : 'bg-gray-500';
                    const statusLabel = member.enrollmentStatus === 'enrolled'
                      ? 'Enrolled' : member.enrollmentStatus === 'invited'
                      ? 'Invited' : 'Pending';

                    return (
                      <div key={member.memberSeasonId} className="flex items-center gap-2 py-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
                        <span className="text-white text-sm flex-1">{member.name}</span>
                        {member.sleeperUsername && (
                          <span className="text-text-muted text-xs">@{member.sleeperUsername}</span>
                        )}
                        <span className="text-text-muted text-xs">{statusLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // DRAFTING PHASE (existing)
  // ──────────────────────────────────────────────
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
            const isExpanded = expandedBoard === draft.boardId;

            return (
              <div key={draft.boardId} className={`glass-card p-4 space-y-3 ${isExpanded ? 'sm:col-span-2' : ''}`} style={{ borderTop: `3px solid ${draft.leagueColor}` }}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold">{draft.leagueName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {draft.sleeperLinked && (
                      <span className="text-xs text-blue-300">Sleeper</span>
                    )}
                    <button
                      onClick={() => setExpandedBoard(isExpanded ? null : draft.boardId)}
                      className="text-xs text-primary hover:underline"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
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

                {/* Collapsed: show 3 recent picks */}
                {!isExpanded && draft.recentPicks.length > 0 && (
                  <div className="space-y-1">
                    {draft.recentPicks.slice(0, 3).map((pick, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted font-mono w-10">R{pick.round}P{pick.pick}</span>
                        <span className={`font-semibold ${posColor[pick.position] || 'text-white'}`}>{pick.playerName}</span>
                        <span className="text-text-muted ml-auto">{pick.teamName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Link to full board */}
                {!isExpanded && (
                  <Link href="/admin/draft" className="block text-center text-xs text-primary hover:underline">
                    Open Full Board
                  </Link>
                )}

                {/* EXPANDED VIEW */}
                {isExpanded && (
                  <div className="space-y-4 pt-2 border-t border-white/10">
                    {/* Section 1: Position Distribution Bar */}
                    {Object.keys(draft.positionBreakdown).length > 0 && (
                      <div>
                        <h4 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Position Distribution</h4>
                        <div className="flex rounded-lg overflow-hidden h-8">
                          {ALL_POSITIONS.map((pos) => {
                            const count = draft.positionBreakdown[pos] || 0;
                            if (count === 0) return null;
                            const pct = (count / draft.picksMade) * 100;
                            return (
                              <div
                                key={pos}
                                className={`${posBgColor[pos] || 'bg-gray-400'} flex items-center justify-center text-xs font-bold text-black/80 transition-all`}
                                style={{ width: `${pct}%` }}
                                title={`${pos}: ${count}`}
                              >
                                {pct > 8 && `${pos} ${count}`}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-3 mt-1">
                          {ALL_POSITIONS.map((pos) => {
                            const count = draft.positionBreakdown[pos] || 0;
                            if (count === 0) return null;
                            return (
                              <span key={pos} className={`text-xs ${posColor[pos] || 'text-white'}`}>
                                {pos} {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 2: Team Roster Grid */}
                    {draft.teamRosters.length > 0 && (
                      <div>
                        <h4 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Team Rosters</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {draft.teamRosters.map((team) => {
                            const isOnClock = draft.currentPick?.memberSeasonId === team.memberSeasonId &&
                              (draft.status === 'drafting' || draft.status === 'paused');
                            return (
                              <div
                                key={team.memberSeasonId}
                                className={`p-3 rounded-lg bg-bg-tertiary/50 space-y-2 ${isOnClock ? 'ring-2 animate-pulse' : ''}`}
                                style={isOnClock ? { ['--tw-ring-color' as string]: draft.leagueColor } : {}}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-white font-bold text-sm">{team.teamName}</span>
                                  <span className="text-text-muted text-xs font-mono">
                                    {team.picks.length}/{draft.numRounds} picks
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(team.positionCounts).map(([pos, count]) => (
                                    <span key={pos} className={`text-xs ${posColor[pos] || 'text-white'}`}>
                                      {count} {pos}
                                    </span>
                                  ))}
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-0.5">
                                  {team.picks.map((pick, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className="text-text-muted font-mono w-10">R{pick.round}P{pick.pick}</span>
                                      <span className={`font-semibold ${posColor[pick.position] || 'text-white'}`}>
                                        {pick.playerName}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 3: League Activity Feed */}
                    {draft.recentPicks.length > 0 && (
                      <div>
                        <h4 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">League Activity</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {draft.recentPicks.map((pick, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                              <span className="text-text-muted font-mono w-10">R{pick.round}P{pick.pick}</span>
                              <span className={`font-semibold ${posColor[pick.position] || 'text-white'}`}>{pick.playerName}</span>
                              <span className="text-text-muted">{pick.position}</span>
                              <span className="text-text-muted ml-auto">{pick.teamName}</span>
                              <span className="text-text-muted">{timeAgo(pick.timestamp)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Link href="/admin/draft" className="block text-center text-xs text-primary hover:underline">
                      Open Full Board
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Summary Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass-card p-3">
            <p className="text-text-muted text-xs">Most Drafted Position</p>
            <p className="text-white font-bold text-sm">
              {stats.mostDrafted ? (
                <><span className={posColor[stats.mostDrafted[0]] || 'text-white'}>{stats.mostDrafted[0]}</span> — {stats.mostDrafted[1]} picks</>
              ) : '—'}
            </p>
          </div>
          <div className="glass-card p-3">
            <p className="text-text-muted text-xs">Fastest League</p>
            <p className="text-white font-bold text-sm">
              {stats.fastest ? `${stats.fastest.name} — ${stats.fastest.count} picks` : '—'}
            </p>
          </div>
          <div className="glass-card p-3">
            <p className="text-text-muted text-xs">Most Recent Pick</p>
            <p className="text-white font-bold text-sm">
              {stats.mostRecent ? (
                <><span className={posColor[stats.mostRecent.position] || 'text-white'}>{stats.mostRecent.playerName}</span> <span className="text-text-muted font-normal text-xs">{timeAgo(stats.mostRecent.timestamp)}</span></>
              ) : '—'}
            </p>
          </div>
          <div className="glass-card p-3">
            <p className="text-text-muted text-xs">Picks This Hour</p>
            <p className="text-white font-bold text-sm">{stats.picksThisHour}</p>
          </div>
        </div>
      )}

      {/* Unified Activity Feed with Filters */}
      {activity.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">All Draft Activity</h3>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-white/10">
            {/* League filters */}
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted text-xs mr-1">Leagues:</span>
              {drafts.map((d) => (
                <button
                  key={d.boardId}
                  onClick={() => toggleLeagueFilter(d.boardId)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${leagueFilters.has(d.boardId) ? 'opacity-100' : 'opacity-30'}`}
                  style={{ backgroundColor: d.leagueColor, borderColor: d.leagueColor }}
                  title={d.leagueShortName || d.leagueName}
                />
              ))}
            </div>

            {/* Position filters */}
            <div className="flex items-center gap-1">
              <span className="text-text-muted text-xs mr-1">Pos:</span>
              {ALL_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => togglePositionFilter(pos)}
                  className={`text-xs px-1.5 py-0.5 rounded font-semibold transition-all ${
                    positionFilters.has(pos) ? `${posColor[pos]} bg-white/10` : 'text-text-muted bg-transparent'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Round filter */}
            <div className="flex items-center gap-1">
              <span className="text-text-muted text-xs mr-1">Round:</span>
              <select
                value={roundFilter ?? ''}
                onChange={(e) => setRoundFilter(e.target.value ? Number(e.target.value) : null)}
                className="text-xs px-2 py-0.5 rounded bg-bg-tertiary border border-white/10 text-white"
              >
                <option value="">All</option>
                {Array.from({ length: maxRounds }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {filteredActivity.map((item, i) => (
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
            {filteredActivity.length === 0 && (
              <p className="text-text-muted text-xs text-center py-4">No picks match current filters</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
