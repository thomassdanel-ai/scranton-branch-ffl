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

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

export default function Step5DraftOrder({
  season,
  leagues,
  members,
  memberSeasons,
  draftBoards,
  flash,
  onComplete,
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
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Step 5: Draft Order</h2>
          <span className="chip chip--success">Locked</span>
        </div>

        <div className="form-grid form-grid--2">
          {leagues.map((league) => {
            const leagueMS = memberSeasons
              .filter((ms) => ms.league_id === league.id)
              .sort((a, b) => (a.draft_position || 0) - (b.draft_position || 0));
            return (
              <div key={league.id} className="subcard" style={cssVars({ '--dot-color': league.color })}>
                <div className="subcard__head">
                  <div className="subcard__title">
                    <span className="subcard__dot" />
                    <span>{league.name}</span>
                  </div>
                </div>
                <div className="draft-order-list">
                  {leagueMS.map((ms) => (
                    <div key={ms.id} className="draft-order-row">
                      <span className="draft-order-row__pos">{ms.draft_position || '?'}</span>
                      <span className="draft-order-row__name">{getMemberName(ms.member_id)}</span>
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
    <div className="wiz-panel">
      <div className="wiz-panel__head">
        <h2 className="wiz-panel__title">Step 5: Draft Order</h2>
      </div>
      <p className="wiz-panel__sub">
        Randomize draft positions per league, then lock to generate pick slots.
      </p>

      <div className="row">
        <button onClick={randomizeDraft} className="btn">
          {Object.keys(draftOrders).length > 0 ? 'Re-roll' : 'Randomize Draft Order'}
        </button>
      </div>

      {Object.keys(draftOrders).length > 0 && (
        <>
          <div className="form-grid form-grid--2">
            {leagues.map((league) => {
              const leagueMS = memberSeasons
                .filter((ms) => ms.league_id === league.id)
                .sort((a, b) => (draftOrders[a.id] || 0) - (draftOrders[b.id] || 0));
              return (
                <div key={league.id} className="subcard" style={cssVars({ '--dot-color': league.color })}>
                  <div className="subcard__head">
                    <div className="subcard__title">
                      <span className="subcard__dot" />
                      <span>{league.name}</span>
                    </div>
                  </div>
                  <div className="draft-order-list">
                    {leagueMS.map((ms) => (
                      <div key={ms.id} className="draft-order-row">
                        <span className="draft-order-row__pos">{draftOrders[ms.id] || '?'}</span>
                        <span className="draft-order-row__name">{getMemberName(ms.member_id)}</span>
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
            className="btn btn--primary"
            style={{ alignSelf: 'flex-start' }}
          >
            {saving ? 'Locking\u2026' : 'Lock Draft Order & Generate Pick Slots'}
          </button>
        </>
      )}
    </div>
  );
}
