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

function statusChipClass(status: string): string {
  if (status === 'active') return 'chip chip--success';
  if (status === 'inactive') return 'chip chip--warning';
  return 'chip chip--muted';
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortAsc, setSortAsc] = useState(true);

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

  function sortArrow(field: SortField) {
    if (sortField !== field) return null;
    return <span className="sort-ind sort-ind--on">{sortAsc ? '\u2191' : '\u2193'}</span>;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading members&hellip;</p>
      </div>
    );
  }

  return (
    <div className="col col--lg">
      <div className="page-head">
        <Link href="/admin" className="back-link">&larr; Back to Admin</Link>
        <div className="row" style={{ justifyContent: 'space-between', width: '100%', alignItems: 'flex-end' }}>
          <h1 className="page-head__title">Members</h1>
          <button onClick={openAdd} className="btn btn--primary">+ Add Member</button>
        </div>
      </div>

      {error && <div className="flash flash--error">{error}</div>}

      <div className="filter-bar">
        <div className="filter-bar__group" style={{ flex: 1, minWidth: 220 }}>
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="inp"
            style={{ width: '100%', maxWidth: 280 }}
          />
        </div>
        <div className="filter-bar__group">
          <span className="filter-bar__lab">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="sel"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="alumni">Alumni</option>
          </select>
        </div>
        <span style={{ marginLeft: 'auto', color: 'var(--ink-5)', font: '500 var(--fs-11) / 1 var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tr-wide)' }}>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th className="data-table__th--sortable" onClick={() => toggleSort('full_name')}>
                Name {sortArrow('full_name')}
              </th>
              <th>Display Name</th>
              <th className="data-table__th--sortable" onClick={() => toggleSort('email')}>
                Email {sortArrow('email')}
              </th>
              <th className="data-table__th--sortable" onClick={() => toggleSort('status')}>
                Status {sortArrow('status')}
              </th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/admin/members/${m.id}`} className="data-table__name">
                    {m.full_name}
                  </Link>
                </td>
                <td className="data-table__muted">{m.display_name || '\u2014'}</td>
                <td className="data-table__muted">{m.email || '\u2014'}</td>
                <td><span className={statusChipClass(m.status)}>{m.status}</span></td>
                <td className="data-table__muted">
                  {m.joined_season ? `S${m.joined_season}` : '\u2014'}
                </td>
                <td>
                  <div className="data-table__actions">
                    <button onClick={() => openEdit(m)} className="action-link action-link--live">Edit</button>
                    {m.status === 'active' && (
                      <button onClick={() => handleStatusChange(m, 'inactive')} className="action-link action-link--clock">
                        Deactivate
                      </button>
                    )}
                    {m.status === 'inactive' && (
                      <>
                        <button onClick={() => handleStatusChange(m, 'active')} className="action-link action-link--live">
                          Reactivate
                        </button>
                        <button onClick={() => handleStatusChange(m, 'alumni')} className="action-link action-link--muted">
                          Archive
                        </button>
                      </>
                    )}
                    {m.status === 'alumni' && (
                      <button onClick={() => handleStatusChange(m, 'active')} className="action-link action-link--live">
                        Reactivate
                      </button>
                    )}
                    <button onClick={() => handleDelete(m)} className="action-link action-link--danger">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="data-table__empty">
                  {members.length === 0
                    ? 'No members yet. Click "+ Add Member" to get started.'
                    : 'No members match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal__backdrop" onClick={() => setShowModal(false)} />
          <form onSubmit={handleSave} className="modal__dialog">
            <h2 className="modal__title">{editingMember ? 'Edit Member' : 'Add Member'}</h2>

            <div>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="inp"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="form-label">
                Display Name
                <span style={{ color: 'var(--ink-5)', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                  (for recaps &amp; UI)
                </span>
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder={formData.full_name.split(' ')[0] || 'First name used if blank'}
                className="inp"
              />
            </div>

            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="inp"
              />
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="txta"
              />
            </div>

            {formError && <p className="form-hint" style={{ color: 'var(--accent-danger)' }}>{formError}</p>}

            <div className="modal__actions">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn--ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn--primary">
                {saving ? 'Saving\u2026' : editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
