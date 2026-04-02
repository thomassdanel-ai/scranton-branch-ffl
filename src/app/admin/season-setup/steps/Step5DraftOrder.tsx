'use client';

import { useState } from 'react';
import type { Season, League, Member, MemberSeason, DraftBoard, FlashFn } from '../page';

type Props = {
  season: Season;
  leagues: League[];
  members: Member[];
  memberSeasons: MemberSeason[];
  draftBoards: DraftBoard[];
  flash: FlashFn;
  onComplete: () => Promise<void>;
  isReview: boolean;
};

export default function Step5DraftOrder({
  season,
  leagues,
  members,
  memberSeasons,
  draftBoards,
  flash,
  onComplete,
  isReview,
}: Props) {
  const [draftOrders, setDraftOrders] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  function getMemberName(memberId: string): string {
    const m = members.find((x) => x.id === memberId);
    return m?.display_name || m?.full_name || 'Unknown';
  }

  // If draft boards exist, show read-only locked view
  if (draftBoards.length > 0) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Step 5: Draft Order</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-accent-green/20 text-accent-green font-semibold">
            Locked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leagues.map((league) => {
            const leagueMS = memberSeasons
              .filter((ms) => ms.league_id === league.id)
              .sort((a, b) => (a.draft_position || 0) - (b.draft_position || 0));
            return (
              <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: league.color }} />
                  <h3 className="font-bold text-white">{league.name}</h3>
                </div>
                <div className="space-y-1">
                  {leagueMS.map((ms) => (
                    <div key={ms.id} className="flex items-center gap-2">
                      <span className="text-accent-gold font-mono text-sm w-6">{ms.draft_position || '?'}.</span>
                      <span className="text-text-secondary text-sm">{getMemberName(ms.member_id)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active state — randomize and lock
  async function randomizeDraft() {
    const res = await fetch('/api/admin/setup/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season.id, action: 'randomize' }),
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
      body: JSON.stringify({ seasonId: season.id, action: 'lock', draftOrders }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Lock failed', 'error');
    } else {
      flash('Draft order locked! Pick slots generated. Season advanced to drafting.', 'success');
    }
    setSaving(false);
    await onComplete();
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-bold text-white">Step 5: Draft Order</h2>
      <p className="text-text-muted text-sm">
        Randomize draft positions per league, then lock to generate pick slots.
      </p>

      <div className="flex gap-3">
        <button
          onClick={randomizeDraft}
          className="px-4 py-2 bg-accent-purple text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          {Object.keys(draftOrders).length > 0 ? 'Re-roll' : 'Randomize Draft Order'}
        </button>
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
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: league.color }} />
                    <h3 className="font-bold text-white">{league.name}</h3>
                  </div>
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
          <button
            onClick={lockDraft}
            disabled={saving}
            className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Locking...' : 'Lock Draft Order & Generate Pick Slots'}
          </button>
        </>
      )}
    </div>
  );
}
