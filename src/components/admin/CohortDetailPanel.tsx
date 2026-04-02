'use client';

import { useState, useEffect } from 'react';
import InviteEmailGenerator from './InviteEmailGenerator';

type Registration = {
  id: string;
  status: string;
  registered_at: string;
  confirmed_at: string | null;
  waitlist_position: number | null;
  members: {
    full_name: string;
    display_name: string | null;
    email: string;
  };
};

type Props = {
  cohortId: string;
  cohortName: string;
  cohortColor: string;
  inviteToken: string;
  seasonYear: string;
  settings: Record<string, unknown>;
  onClose: () => void;
};

export default function CohortDetailPanel({
  cohortId,
  cohortName,
  cohortColor,
  inviteToken,
  seasonYear,
  settings,
  onClose,
}: Props) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${siteUrl}/register/${inviteToken}`;
  const maxCapacity = (settings?.maxCapacity as number) || null;

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/cohorts/${cohortId}/registrations`);
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations || []);
      }
      setLoading(false);
    }
    load();
  }, [cohortId]);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const statusCounts = registrations.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const total = registrations.length;
  const confirmed = statusCounts['confirmed'] || 0;
  const waitlisted = statusCounts['waitlisted'] || 0;
  const registered = statusCounts['registered'] || 0;
  const promoted = statusCounts['promoted'] || 0;

  const statusColors: Record<string, string> = {
    registered: 'bg-blue-500/20 text-blue-300',
    confirmed: 'bg-green-500/20 text-green-300',
    waitlisted: 'bg-yellow-500/20 text-yellow-300',
    promoted: 'bg-purple-500/20 text-purple-300',
  };

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cohortColor }} />
          <h3 className="text-lg font-bold text-white">{cohortName}</h3>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-white text-sm transition-colors">
          Close
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-bg-tertiary rounded-lg p-3 text-center">
          <p className="text-2xl font-mono font-bold text-white">{registered}</p>
          <p className="text-text-muted text-xs">Registered</p>
        </div>
        <div className="bg-bg-tertiary rounded-lg p-3 text-center">
          <p className="text-2xl font-mono font-bold text-green-300">{confirmed + promoted}</p>
          <p className="text-text-muted text-xs">Confirmed</p>
        </div>
        <div className="bg-bg-tertiary rounded-lg p-3 text-center">
          <p className="text-2xl font-mono font-bold text-yellow-300">{waitlisted}</p>
          <p className="text-text-muted text-xs">Waitlisted</p>
        </div>
        <div className="bg-bg-tertiary rounded-lg p-3 text-center">
          <p className="text-2xl font-mono font-bold text-text-secondary">
            {maxCapacity ? `${total}/${maxCapacity}` : total}
          </p>
          <p className="text-text-muted text-xs">{maxCapacity ? 'Capacity' : 'Total'}</p>
        </div>
      </div>

      {/* Progress bar */}
      {maxCapacity && (
        <div className="w-full bg-bg-tertiary rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(100, (total / maxCapacity) * 100)}%`,
              backgroundColor: cohortColor,
            }}
          />
        </div>
      )}

      {/* Invite Link */}
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs text-primary bg-bg-tertiary px-3 py-2 rounded flex-1 truncate">
          {inviteUrl}
        </code>
        <button
          onClick={copyLink}
          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            linkCopied ? 'bg-green-500/20 text-green-300' : 'bg-primary/20 text-primary hover:bg-primary/30'
          }`}
        >
          {linkCopied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={() => setShowEmail(!showEmail)}
          className="px-3 py-2 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
        >
          {showEmail ? 'Hide Email' : 'Generate Email'}
        </button>
      </div>

      {/* Email Generator */}
      {showEmail && (
        <InviteEmailGenerator
          cohortName={cohortName}
          seasonYear={seasonYear}
          inviteUrl={inviteUrl}
        />
      )}

      {/* Registration list */}
      {loading ? (
        <p className="text-text-muted text-sm">Loading registrations...</p>
      ) : registrations.length === 0 ? (
        <p className="text-text-muted text-sm">No registrations yet.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {registrations.map((reg) => (
            <div key={reg.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-tertiary/50">
              <div>
                <p className="text-white text-sm font-medium">
                  {reg.members?.display_name || reg.members?.full_name || 'Unknown'}
                </p>
                <p className="text-text-muted text-xs">{reg.members?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[reg.status] || 'bg-white/10 text-white'}`}>
                  {reg.status}
                </span>
                <span className="text-text-muted text-xs">
                  {new Date(reg.registered_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
