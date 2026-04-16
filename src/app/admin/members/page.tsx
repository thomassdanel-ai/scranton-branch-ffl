'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
};

type SortField = 'full_name' | 'status' | 'email' | 'created_at';

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortAsc, setSortAsc] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({ full_name: '', display_name: '', email: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/admin/members');
    if (res.status === 401) {
      router.push('/admin');
      return;
    }
    if (!res.ok) {
      setError('Failed to load members');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMembers(data.members);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  function openAdd() {
    setEditingMember(null);
    setFormData({ full_name: '', display_name: '', email: '', notes: '' });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(member: Member) {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      display_name: member.display_name || '',
      email: member.email || '',
      notes: member.notes || '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    const url = editingMember
      ? `/api/admin/members/${editingMember.id}`
      : '/api/admin/members';

    const res = await fetch(url, {
      method: editingMember ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const err = await res.json();
      setFormError(err.error || 'Save failed');
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);
    fetchMembers();
  }

  async function handleStatusChange(member: Member, newStatus: string) {
    await fetch(`/api/admin/members/${member.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchMembers();
  }

  async function handleDelete(member: Member) {
    if (!confirm(`Delete ${member.full_name}? This cannot be undone.`)) return;

    const res = await fetch(`/api/admin/members/${member.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Delete failed');
      return;
    }
    fetchMembers();
  }

  // Filter and sort
  const filtered = members
    .filter((m) => statusFilter === 'all' || m.status === statusFilter)
    .filter((m) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.display_name && m.display_name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-accent-green/20 text-accent-green',
      inactive: 'bg-yellow-500/20 text-yellow-400',
      alumni: 'bg-text-muted/20 text-text-muted',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || ''}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-text-muted text-sm hover:text-white transition-colors">
            &larr; Back to Admin
          </Link>
          <h1 className="text-2xl font-extrabold text-white mt-1">Members</h1>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
        >
          + Add Member
        </button>
      </div>

      {error && <p className="text-accent-red">{error}</p>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted text-sm focus:outline-hidden focus:border-primary w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-hidden focus:border-primary"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="alumni">Alumni</option>
        </select>
        <span className="text-text-muted text-sm ml-auto">
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th
                className="px-4 py-3 text-text-muted font-medium cursor-pointer hover:text-white"
                onClick={() => toggleSort('full_name')}
              >
                Name {sortField === 'full_name' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="px-4 py-3 text-text-muted font-medium">Display Name</th>
              <th
                className="px-4 py-3 text-text-muted font-medium cursor-pointer hover:text-white"
                onClick={() => toggleSort('email')}
              >
                Email {sortField === 'email' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th
                className="px-4 py-3 text-text-muted font-medium cursor-pointer hover:text-white"
                onClick={() => toggleSort('status')}
              >
                Status {sortField === 'status' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="px-4 py-3 text-text-muted font-medium">Joined</th>
              <th className="px-4 py-3 text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/members/${m.id}`}
                    className="text-white font-medium hover:text-primary transition-colors"
                  >
                    {m.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-secondary">{m.display_name || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{m.email || '—'}</td>
                <td className="px-4 py-3">{statusBadge(m.status)}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {m.joined_season ? `S${m.joined_season}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(m)}
                      className="text-primary text-xs hover:underline"
                    >
                      Edit
                    </button>
                    {m.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(m, 'inactive')}
                        className="text-yellow-400 text-xs hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                    {m.status === 'inactive' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(m, 'active')}
                          className="text-accent-green text-xs hover:underline"
                        >
                          Reactivate
                        </button>
                        <button
                          onClick={() => handleStatusChange(m, 'alumni')}
                          className="text-text-muted text-xs hover:underline"
                        >
                          Archive
                        </button>
                      </>
                    )}
                    {m.status === 'alumni' && (
                      <button
                        onClick={() => handleStatusChange(m, 'active')}
                        className="text-accent-green text-xs hover:underline"
                      >
                        Reactivate
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(m)}
                      className="text-accent-red text-xs hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  {members.length === 0
                    ? 'No members yet. Click "+ Add Member" to get started.'
                    : 'No members match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form
            onSubmit={handleSave}
            className="glass-card p-6 w-full max-w-md space-y-4 mx-4"
          >
            <h2 className="text-lg font-bold text-white">
              {editingMember ? 'Edit Member' : 'Add Member'}
            </h2>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-hidden focus:border-primary"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Display Name <span className="text-text-muted">(for recaps & UI)</span>
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder={formData.full_name.split(' ')[0] || 'First name used if blank'}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted text-sm focus:outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-hidden focus:border-primary resize-none"
              />
            </div>

            {formError && <p className="text-accent-red text-sm">{formError}</p>}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-text-secondary hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
