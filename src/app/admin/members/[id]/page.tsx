'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

type Member = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string | null;
  status: 'active' | 'inactive' | 'alumni';
  joined_season: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SeasonEntry = {
  id: string;
  sleeper_roster_id: string | null;
  sleeper_display_name: string | null;
  draft_position: number | null;
  onboard_status: string;
  leagues: { name: string; sleeper_league_id: string | null } | null;
  seasons: { year: number; season_number: number } | null;
};

function statusChipClass(status: string): string {
  if (status === 'active') return 'chip chip--success';
  if (status === 'inactive') return 'chip chip--warning';
  return 'chip chip--muted';
}

function onboardChipClass(status: string): string {
  if (status === 'confirmed') return 'chip chip--success';
  if (status === 'declined') return 'chip chip--danger';
  return 'chip chip--warning';
}

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;

  const [member, setMember] = useState<Member | null>(null);
  const [seasons, setSeasons] = useState<SeasonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchMember = useCallback(async () => {
    const res = await fetch(`/api/admin/members/${memberId}`);
    if (res.status === 401) {
      router.push('/admin');
      return;
    }
    if (res.status === 404) {
      router.push('/admin/members');
      return;
    }
    const data = await res.json();
    setMember(data.member);
    setSeasons(data.seasons);
    setNotes(data.member.notes || '');
    setLoading(false);
  }, [memberId, router]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  async function saveNotes() {
    setSavingNotes(true);
    await fetch(`/api/admin/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setSavingNotes(false);
    setEditingNotes(false);
    fetchMember();
  }

  if (loading || !member) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading member&hellip;</p>
      </div>
    );
  }

  return (
    <div className="col col--lg" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <Link href="/admin/members" className="back-link">&larr; Back to Members</Link>
      </div>

      {/* Header panel */}
      <div className="wiz-panel">
        <div className="wiz-panel__head" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-head__title" style={{ marginBottom: 2 }}>{member.full_name}</h1>
            {member.display_name && (
              <p className="wiz-panel__sub">
                aka &ldquo;{member.display_name}&rdquo;
              </p>
            )}
          </div>
          <span className={statusChipClass(member.status)}>{member.status}</span>
        </div>

        <div className="kv-grid">
          <div className="kv">
            <div className="kv__lab">Email</div>
            <div className="kv__val">{member.email || '\u2014'}</div>
          </div>
          <div className="kv">
            <div className="kv__lab">Joined</div>
            <div className="kv__val">{member.joined_season ? `Season ${member.joined_season}` : '\u2014'}</div>
          </div>
          <div className="kv">
            <div className="kv__lab">Seasons Played</div>
            <div className="kv__val">{seasons.length}</div>
          </div>
          <div className="kv">
            <div className="kv__lab">Member Since</div>
            <div className="kv__val">{new Date(member.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Commissioner Notes</h2>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="action-link action-link--live">
              Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="col col--sm">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="txta"
              autoFocus
            />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditingNotes(false); setNotes(member.notes || ''); }}
                className="btn btn--ghost btn--sm"
              >
                Cancel
              </button>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="btn btn--primary btn--sm"
              >
                {savingNotes ? 'Saving\u2026' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className={`notes-box ${!member.notes ? 'notes-box--empty' : ''}`}>
            {member.notes || 'No notes yet.'}
          </p>
        )}
      </div>

      {/* Season History */}
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Season History</h2>
        </div>
        {seasons.length === 0 ? (
          <p className="form-hint">No season history yet.</p>
        ) : (
          <div className="col col--sm">
            {seasons.map((s) => (
              <div key={s.id} className="hist-entry">
                <div className="hist-entry__body">
                  <div className="hist-entry__primary">
                    Season {s.seasons?.season_number || '?'}{' '}
                    <span className="hist-entry__year">({s.seasons?.year})</span>
                  </div>
                  <div className="hist-entry__secondary">
                    {s.leagues?.name || 'Unknown League'}
                    {s.sleeper_display_name && ` \u2014 "${s.sleeper_display_name}"`}
                  </div>
                </div>
                <div className="hist-entry__meta">
                  {s.draft_position && (
                    <span className="hist-entry__draft">Draft #{s.draft_position}</span>
                  )}
                  <span className={onboardChipClass(s.onboard_status)}>
                    {s.onboard_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
