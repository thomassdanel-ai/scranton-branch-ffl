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
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading member...</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-accent-green/20 text-accent-green',
    inactive: 'bg-yellow-500/20 text-yellow-400',
    alumni: 'bg-text-muted/20 text-text-muted',
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin/members" className="text-text-muted text-sm hover:text-white transition-colors">
        &larr; Back to Members
      </Link>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">{member.full_name}</h1>
            {member.display_name && (
              <p className="text-text-secondary mt-1">
                aka &ldquo;{member.display_name}&rdquo;
              </p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[member.status]}`}>
            {member.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 text-sm">
          <div>
            <p className="text-text-muted">Email</p>
            <p className="text-white">{member.email || '—'}</p>
          </div>
          <div>
            <p className="text-text-muted">Joined</p>
            <p className="text-white">{member.joined_season ? `Season ${member.joined_season}` : '—'}</p>
          </div>
          <div>
            <p className="text-text-muted">Seasons Played</p>
            <p className="text-white">{seasons.length}</p>
          </div>
          <div>
            <p className="text-text-muted">Member Since</p>
            <p className="text-white">{new Date(member.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Commissioner Notes</h2>
          {!editingNotes && (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-primary text-sm hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditingNotes(false); setNotes(member.notes || ''); }}
                className="text-text-secondary text-sm hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="px-3 py-1 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
              >
                {savingNotes ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary text-sm whitespace-pre-wrap">
            {member.notes || 'No notes yet.'}
          </p>
        )}
      </div>

      {/* Season History */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">Season History</h2>
        {seasons.length === 0 ? (
          <p className="text-text-muted text-sm">No season history yet.</p>
        ) : (
          <div className="space-y-3">
            {seasons.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary/50">
                <div>
                  <p className="text-white font-medium">
                    Season {s.seasons?.season_number || '?'}{' '}
                    <span className="text-text-muted">({s.seasons?.year})</span>
                  </p>
                  <p className="text-text-secondary text-sm">
                    {s.leagues?.name || 'Unknown League'}
                    {s.sleeper_display_name && ` — "${s.sleeper_display_name}"`}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {s.draft_position && (
                    <p className="text-text-muted">Draft #{s.draft_position}</p>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    s.onboard_status === 'confirmed'
                      ? 'bg-accent-green/20 text-accent-green'
                      : s.onboard_status === 'declined'
                        ? 'bg-accent-red/20 text-accent-red'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
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
