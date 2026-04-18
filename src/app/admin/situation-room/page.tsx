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

type StatusVariant = {
  label: string;
  chipClass: string;
};

const statusConfig: Record<string, StatusVariant> = {
  pending:   { label: 'Not Started', chipClass: 'chip chip--clock' },
  drafting:  { label: 'On Air',      chipClass: 'chip chip--live' },
  paused:    { label: 'Paused',      chipClass: 'chip chip--danger' },
  completed: { label: 'Complete',    chipClass: 'chip' },
};

const ALL_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

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
      <div className="wrap" style={{ paddingTop: 40 }}>
        <div className="kicker">
          <span className="kicker__dot" /> Loading situation room
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="wrap" style={{ paddingTop: 20 }}>
        <div className="crumb-bar">
          <Link href="/admin">Command Center</Link>
          <span className="sep">/</span>
          <b>Situation Room</b>
        </div>
        <div className="admin-empty" style={{ marginTop: 24 }}>
          <div className="admin-empty__title">No Active Season</div>
          <p className="admin-empty__desc">
            Start a season and set up drafts to use the Situation Room.
          </p>
          <Link href="/admin" className="btn btn--primary" style={{ marginTop: 8 }}>
            Back to Command Center
          </Link>
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
      <div className="wrap" style={{ paddingTop: 20, paddingBottom: 60 }}>
        <div className="crumb-bar">
          <Link href="/admin">Command Center</Link>
          <span className="sep">/</span>
          <b>Situation Room</b>
          <span className="sep">·</span>
          <span>Enrollment</span>
        </div>

        {/* Head bar */}
        <div className="sr-head" style={{ marginTop: 20 }}>
          <div>
            <h1 className="sr-head__title">Situation Room</h1>
            <div className="sr-head__sub">
              Season {season.season_number} ({season.year}) · Enrollment Phase
            </div>
          </div>
          <div className="sr-head__prog">
            <div>
              <div className="sr-head__prog-text">{summary.enrolled}/{summary.totalMembers} enrolled</div>
              <div className="sr-head__prog-sub">{summary.invited} invited · {summary.pending} pending</div>
            </div>
            <div className="progress progress--lg" style={{ width: 120 }}>
              <div className="progress__fill" style={{ width: `${enrollProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Status message */}
        {enrollmentMessage && (
          <div className="sr-banner" style={{ marginTop: 14 }}>{enrollmentMessage}</div>
        )}

        {/* All enrolled banner */}
        {allEnrolled && (
          <div className="sr-banner sr-banner--ok" style={{ marginTop: 14 }}>
            <div>
              <strong style={{ fontSize: 'var(--fs-14)' }}>All members enrolled.</strong>
              <div style={{ fontSize: 'var(--fs-12)', color: 'var(--ink-6)', marginTop: 4 }}>
                Everyone has joined their Sleeper league. Ready for draft setup.
              </div>
            </div>
            <Link href="/admin/season-setup" className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }}>
              Continue to Draft Setup
            </Link>
          </div>
        )}

        {/* Page-level actions */}
        <div className="row" style={{ marginTop: 16 }}>
          <button
            onClick={() => handleCheckEnrollment()}
            disabled={checkingEnrollment}
            className="btn btn--sm"
          >
            {checkingEnrollment ? 'Checking…' : 'Check All Leagues'}
          </button>
        </div>

        {/* League Cards */}
        <div className="sr-grid" style={{ marginTop: 16 }}>
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
              <div
                key={league.leagueId}
                className="sr-card"
                style={cssVars({ '--league-color': league.leagueColor })}
              >
                {/* Header */}
                <div className="sr-card__head">
                  <div className="sr-card__title">{league.leagueName}</div>
                  {isLinked && <span className="chip">Sleeper Linked</span>}
                </div>

                {/* Progress ring */}
                <div className="sr-card__body">
                  <div className="ring" style={cssVars({ '--ring-color': league.leagueColor })}>
                    <svg viewBox="0 0 36 36">
                      <path className="ring__track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" strokeWidth="3" />
                      <path className="ring__fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" strokeWidth="3"
                        strokeDasharray={`${progress}, 100`} strokeLinecap="round" />
                    </svg>
                    <div className="ring__label">{progress}%</div>
                  </div>
                  <div className="sr-card__body-text">
                    <span className="n">{enrolled}/{total} enrolled</span>
                    {league.lastCheckAt && <span className="m">Checked {timeAgo(league.lastCheckAt)}</span>}
                  </div>
                </div>

                {/* Link Sleeper league (if not linked) */}
                {!isLinked && (
                  <div className="enroll-panel">
                    <div className="enroll-panel__lab">Link to Sleeper</div>
                    <input
                      type="text"
                      value={input.leagueId}
                      onChange={(e) => setLinkInputs((prev) => ({ ...prev, [league.leagueId]: { ...input, leagueId: e.target.value } }))}
                      placeholder="Sleeper League ID or URL"
                      className="inp"
                    />
                    <input
                      type="text"
                      value={input.inviteLink}
                      onChange={(e) => setLinkInputs((prev) => ({ ...prev, [league.leagueId]: { ...input, inviteLink: e.target.value } }))}
                      placeholder="Sleeper invite link (sleeper.com/i/…)"
                      className="inp"
                    />
                    <button
                      onClick={() => handleLinkLeague(league.leagueId)}
                      className="btn btn--primary btn--sm"
                    >
                      Link League
                    </button>
                  </div>
                )}

                {/* Invite link input if linked but no invite link */}
                {isLinked && !hasInviteLink && (
                  <div className="enroll-panel">
                    <div className="enroll-panel__lab">Add Invite Link</div>
                    <input
                      type="text"
                      value={input.inviteLink}
                      onChange={(e) => setLinkInputs((prev) => ({ ...prev, [league.leagueId]: { ...input, inviteLink: e.target.value } }))}
                      placeholder="Sleeper invite link (sleeper.com/i/…)"
                      className="inp"
                    />
                    <button
                      onClick={() => handleLinkLeague(league.leagueId)}
                      className="btn btn--primary btn--sm"
                    >
                      Save Link
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                {hasInviteLink && (
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      onClick={() => handleSendEmails(league.leagueId, 'invite')}
                      disabled={isSending || pendingInvites === 0}
                      className="btn btn--sm"
                      style={{ flex: 1 }}
                    >
                      {isSending ? 'Sending…' : `Send Invites (${pendingInvites})`}
                    </button>
                    <button
                      onClick={() => handleSendEmails(league.leagueId, 'reminder')}
                      disabled={isSending || pendingReminders === 0}
                      className="btn btn--sm"
                      style={{ flex: 1 }}
                    >
                      Remind ({pendingReminders})
                    </button>
                    <button
                      onClick={() => handleCheckEnrollment(league.leagueId)}
                      disabled={checkingEnrollment}
                      className="btn btn--sm"
                    >
                      Check
                    </button>
                  </div>
                )}

                {/* Member list */}
                <div className="mlist">
                  {league.members.map((member) => {
                    const dotClass =
                      member.enrollmentStatus === 'enrolled' ? 'mlist__dot--enrolled' :
                      member.enrollmentStatus === 'invited' ? 'mlist__dot--invited' :
                      'mlist__dot--pending';
                    const statusLabel =
                      member.enrollmentStatus === 'enrolled' ? 'Enrolled' :
                      member.enrollmentStatus === 'invited' ? 'Invited' :
                      'Pending';

                    return (
                      <div key={member.memberSeasonId} className="mlist__row">
                        <div className={`mlist__dot ${dotClass}`} />
                        <span className="mlist__name">{member.name}</span>
                        {member.sleeperUsername && (
                          <span className="mlist__handle">@{member.sleeperUsername}</span>
                        )}
                        <span className="mlist__status">{statusLabel}</span>
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
  // DRAFTING PHASE
  // ──────────────────────────────────────────────
  const activeDrafts = drafts.filter((d) => d.status === 'drafting' || d.status === 'paused');
  const totalPicks = drafts.reduce((a, d) => a + d.totalPicks, 0);
  const totalMade = drafts.reduce((a, d) => a + d.picksMade, 0);
  const globalProgress = totalPicks > 0 ? Math.round((totalMade / totalPicks) * 100) : 0;

  return (
    <div className="wrap" style={{ paddingTop: 20, paddingBottom: 60 }}>
      <div className="crumb-bar">
        <Link href="/admin">Command Center</Link>
        <span className="sep">/</span>
        <b>Situation Room</b>
      </div>

      {/* Head bar */}
      <div className="sr-head" style={{ marginTop: 20 }}>
        <div>
          <h1 className="sr-head__title">Situation Room</h1>
          <div className="sr-head__sub">
            Season {season.season_number} ({season.year}) · {activeDrafts.length} of {drafts.length} drafts active · {globalProgress}% complete
          </div>
        </div>
        <div className="sr-head__prog">
          <div>
            <div className="sr-head__prog-text">{totalMade}/{totalPicks}</div>
            <div className="sr-head__prog-sub">picks made</div>
          </div>
          <div className="progress progress--lg" style={{ width: 120 }}>
            <div className="progress__fill" style={{ width: `${globalProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Draft Cards Grid */}
      {drafts.length === 0 ? (
        <div className="admin-empty" style={{ marginTop: 20 }}>
          <div className="admin-empty__title">No Draft Boards</div>
          <p className="admin-empty__desc">
            Complete the draft setup in the Season Setup Wizard to create draft boards.
          </p>
        </div>
      ) : (
        <div className="sr-grid" style={{ marginTop: 20 }}>
          {drafts.map((draft) => {
            const progress = draft.totalPicks > 0 ? Math.round((draft.picksMade / draft.totalPicks) * 100) : 0;
            const cfg = statusConfig[draft.status] || { label: draft.status, chipClass: 'chip' };
            const isExpanded = expandedBoard === draft.boardId;
            const isLive = draft.status === 'drafting';

            return (
              <div
                key={draft.boardId}
                className={`sr-card ${isExpanded ? 'sr-card--wide' : ''}`}
                style={cssVars({ '--league-color': draft.leagueColor })}
              >
                {/* Header */}
                <div className="sr-card__head">
                  <div className="row" style={{ gap: 8 }}>
                    <div className="sr-card__title">{draft.leagueName}</div>
                    <span className={cfg.chipClass}>
                      {isLive && <span className="livedot" />}
                      {cfg.label}
                    </span>
                  </div>
                  <div className="sr-card__meta">
                    {draft.sleeperLinked && <span>Sleeper</span>}
                    <button
                      onClick={() => setExpandedBoard(isExpanded ? null : draft.boardId)}
                      className="btn btn--ghost btn--sm"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="sr-card__body">
                  <div className="ring" style={cssVars({ '--ring-color': draft.leagueColor })}>
                    <svg viewBox="0 0 36 36">
                      <path className="ring__track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" strokeWidth="3" />
                      <path className="ring__fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" strokeWidth="3"
                        strokeDasharray={`${progress}, 100`} strokeLinecap="round" />
                    </svg>
                    <div className="ring__label">{progress}%</div>
                  </div>
                  <div className="sr-card__body-text">
                    <span className="n">{draft.picksMade}/{draft.totalPicks} picks</span>
                    {draft.lastSyncedAt && <span className="m">Synced {timeAgo(draft.lastSyncedAt)}</span>}
                  </div>
                </div>

                {/* Current Pick */}
                {draft.currentPick && (draft.status === 'drafting' || draft.status === 'paused') && (
                  <div className="sr-clock">
                    <span className="sr-clock__lab">
                      <span className="livedot livedot--clock" /> On the Clock
                    </span>
                    <span className="sr-clock__team">{draft.currentPick.teamName}</span>
                    <span className="sr-clock__pick">Round {draft.currentPick.round} · Pick {draft.currentPick.pick}</span>
                  </div>
                )}

                {/* Collapsed: show 3 recent picks */}
                {!isExpanded && draft.recentPicks.length > 0 && (
                  <div className="pick-list">
                    {draft.recentPicks.slice(0, 3).map((pick, i) => (
                      <div key={i} className="pick-row">
                        <span className="pick-row__rp">R{pick.round}P{pick.pick}</span>
                        <span className="pick-row__player pos-text" data-pos={pick.position}>{pick.playerName}</span>
                        <span className="pick-row__team">{pick.teamName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Link to full board (collapsed) */}
                {!isExpanded && (
                  <Link
                    href="/admin/draft"
                    className="btn btn--ghost btn--sm"
                    style={{ justifyContent: 'center' }}
                  >
                    Open Full Board →
                  </Link>
                )}

                {/* EXPANDED VIEW */}
                {isExpanded && (
                  <div className="col col--lg" style={{ borderTop: 'var(--hairline)', paddingTop: 12 }}>
                    {/* Position Distribution Bar */}
                    {Object.keys(draft.positionBreakdown).length > 0 && (
                      <div>
                        <div className="sr-sub">Position Distribution</div>
                        <div className="posbar">
                          {ALL_POSITIONS.map((pos) => {
                            const count = draft.positionBreakdown[pos] || 0;
                            if (count === 0) return null;
                            const pct = draft.picksMade > 0 ? (count / draft.picksMade) * 100 : 0;
                            return (
                              <div
                                key={pos}
                                className="posbar__seg pos-bg"
                                data-pos={pos}
                                style={{ width: `${pct}%` }}
                                title={`${pos}: ${count}`}
                              >
                                {pct > 8 && `${pos} ${count}`}
                              </div>
                            );
                          })}
                        </div>
                        <div className="posbar__legend">
                          {ALL_POSITIONS.map((pos) => {
                            const count = draft.positionBreakdown[pos] || 0;
                            if (count === 0) return null;
                            return (
                              <span key={pos} className="pos-text" data-pos={pos}>
                                {pos} {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Team Roster Grid */}
                    {draft.teamRosters.length > 0 && (
                      <div>
                        <div className="sr-sub">Team Rosters</div>
                        <div className="roster-grid">
                          {draft.teamRosters.map((team) => {
                            const isOnClock = draft.currentPick?.memberSeasonId === team.memberSeasonId &&
                              (draft.status === 'drafting' || draft.status === 'paused');
                            return (
                              <div
                                key={team.memberSeasonId}
                                className={`roster ${isOnClock ? 'roster--onclock' : ''}`}
                                style={isOnClock ? cssVars({ '--roster-color': draft.leagueColor }) : undefined}
                              >
                                <div className="roster__head">
                                  <span className="roster__name">{team.teamName}</span>
                                  <span className="roster__count">{team.picks.length}/{draft.numRounds}</span>
                                </div>
                                <div className="roster__pos-summary">
                                  {Object.entries(team.positionCounts).map(([pos, count]) => (
                                    <span key={pos} className="pos-text" data-pos={pos}>
                                      {count} {pos}
                                    </span>
                                  ))}
                                </div>
                                <div className="roster__list">
                                  {team.picks.map((pick, i) => (
                                    <div key={i} className="pick-row">
                                      <span className="pick-row__rp">R{pick.round}P{pick.pick}</span>
                                      <span className="pick-row__player pos-text" data-pos={pick.position}>{pick.playerName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* League Activity */}
                    {draft.recentPicks.length > 0 && (
                      <div>
                        <div className="sr-sub">League Activity</div>
                        <div className="pick-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                          {draft.recentPicks.map((pick, i) => (
                            <div key={i} className="pick-row">
                              <span className="pick-row__rp">R{pick.round}P{pick.pick}</span>
                              <span className="pick-row__player pos-text" data-pos={pick.position}>
                                {pick.playerName}
                                <span className="pick-row__pos">{pick.position}</span>
                              </span>
                              <span className="pick-row__team">
                                {pick.teamName}
                                <span style={{ marginLeft: 8, color: 'var(--ink-5)' }}>{timeAgo(pick.timestamp)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Link
                      href="/admin/draft"
                      className="btn btn--ghost btn--sm"
                      style={{ justifyContent: 'center' }}
                    >
                      Open Full Board →
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
        <div className="stat-row" style={{ marginTop: 20 }}>
          <div className="stat-mini">
            <div className="stat-mini__lab">Most Drafted Position</div>
            <div className="stat-mini__val">
              {stats.mostDrafted ? (
                <>
                  <span className="pos-text" data-pos={stats.mostDrafted[0]}>{stats.mostDrafted[0]}</span>
                  <span className="stat-mini__note" style={{ marginLeft: 6 }}>{stats.mostDrafted[1]} picks</span>
                </>
              ) : '—'}
            </div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini__lab">Fastest League</div>
            <div className="stat-mini__val">
              {stats.fastest ? `${stats.fastest.name}` : '—'}
            </div>
            {stats.fastest && <div className="stat-mini__note">{stats.fastest.count} picks</div>}
          </div>
          <div className="stat-mini">
            <div className="stat-mini__lab">Most Recent Pick</div>
            <div className="stat-mini__val">
              {stats.mostRecent ? (
                <span className="pos-text" data-pos={stats.mostRecent.position}>{stats.mostRecent.playerName}</span>
              ) : '—'}
            </div>
            {stats.mostRecent && <div className="stat-mini__note">{timeAgo(stats.mostRecent.timestamp)}</div>}
          </div>
          <div className="stat-mini">
            <div className="stat-mini__lab">Picks This Hour</div>
            <div className="stat-mini__val">{stats.picksThisHour}</div>
          </div>
        </div>
      )}

      {/* Unified Activity Feed with Filters */}
      {activity.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card__head" style={{ paddingBottom: 0, borderBottom: 'none' }}>
            <div className="card__title">All Draft Activity</div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            {/* League filters */}
            <div className="filter-bar__group">
              <span className="filter-bar__lab">Leagues</span>
              {drafts.map((d) => (
                <button
                  key={d.boardId}
                  onClick={() => toggleLeagueFilter(d.boardId)}
                  className={`dotbtn ${leagueFilters.has(d.boardId) ? 'dotbtn--on' : ''}`}
                  style={cssVars({ '--dot-color': d.leagueColor })}
                  title={d.leagueShortName || d.leagueName}
                />
              ))}
            </div>

            {/* Position filters */}
            <div className="filter-bar__group">
              <span className="filter-bar__lab">Pos</span>
              {ALL_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => togglePositionFilter(pos)}
                  className={`posbtn ${positionFilters.has(pos) ? 'posbtn--on pos-text' : ''}`}
                  data-pos={positionFilters.has(pos) ? pos : undefined}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Round filter */}
            <div className="filter-bar__group">
              <span className="filter-bar__lab">Round</span>
              <select
                value={roundFilter ?? ''}
                onChange={(e) => setRoundFilter(e.target.value ? Number(e.target.value) : null)}
                className="sel"
              >
                <option value="">All</option>
                {Array.from({ length: maxRounds }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rows */}
          <div className="act-list">
            {filteredActivity.map((item, i) => (
              <div key={i} className="act-row">
                <div className="act-row__dot" style={{ background: item.leagueColor }} />
                <span className="act-row__overall">#{item.overall}</span>
                <span className="act-row__player pos-text" data-pos={item.position}>
                  {item.playerName}
                  <span className="pick-row__pos">{item.position}</span>
                </span>
                <span className="act-row__team">{item.teamName}</span>
                <span className="act-row__league">{item.leagueShortName || item.leagueName}</span>
                <span className="act-row__time">{timeAgo(item.timestamp)}</span>
              </div>
            ))}
            {filteredActivity.length === 0 && (
              <p style={{ color: 'var(--ink-5)', fontSize: 'var(--fs-12)', textAlign: 'center', padding: '20px 0' }}>
                No picks match current filters
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
