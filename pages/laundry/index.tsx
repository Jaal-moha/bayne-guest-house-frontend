import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import axios from '@/utils/axiosInstance';
import Link from 'next/link';
import RequireAuth from '@/components/RequireAuth';

const ALLOWED_STATUSES = ['pending', 'in_progress', 'done'] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

type Laundry = { id: number; guestId: number; items: string; status: 'pending' | 'in_progress' | 'done'; createdAt: string | Date; guest?: { name: string; }; };
type Guest = { id: number; name: string; };

// Add Laundry Modal component
function AddLaundryModal({
  open, onClose, guests, onCreated, submitting, setSubmitting, statuses,
}: {
  open: boolean;
  onClose: () => void;
  guests: { id: number; name: string; }[];
  onCreated: (row: any) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  statuses: string[];
}) {
  const [guestId, setGuestId] = useState('');
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<{ name: string; qty: number; }[]>([{ name: '', qty: 1 }]);
  const [error, setError] = useState('');
  const [price, setPrice] = useState<string>(''); // ← NEW

  const reset = () => { setGuestId(''); setStatus(ALLOWED_STATUSES[0]); setItems([{ name: '', qty: 1 }]); setError(''); setPrice(''); };

  useEffect(() => { if (open) reset(); }, [open, statuses]);

  const updateItem = (i: number, patch: Partial<{ name: string; qty: number; }>) => {
    setItems(list => list.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };
  const addRow = () => setItems(l => [...l, { name: '', qty: 1 }]);
  const removeRow = (i: number) => setItems(l => l.length === 1 ? l : l.filter((_, idx) => idx !== i));

  const buildItemsString = () => {
    return items
      .filter(r => r.name.trim() && r.qty > 0)
      .map(r => `${r.qty} ${r.name.trim()}`)
      .join(', ');
  };

  const submit = async () => {
    setError('');
    if (!guestId) return setError('Guest required');
    const filtered = items.filter(r => r.name.trim() && r.qty > 0);
    if (filtered.length === 0) return setError('Add at least one item');
    const itemsStr = buildItemsString();
    const priceNum = price.trim() ? Number(price) : 0;
    if (!Number.isFinite(priceNum) || priceNum < 0) return setError('Price must be a non-negative number');
    try {
      setSubmitting(true);
      const res = await axios.post('/laundry', {
        guestId: Number(guestId),
        items: itemsStr,
        status: status || 'pending',
        price: priceNum, // ← include price
      });
      const created = res.data?.laundry ?? res.data;
      onCreated(created);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Laundry</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">✕</button>
        </div>
        {error && <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Guest</label>
              <select
                className="w-full rounded border px-3 py-2"
                value={guestId}
                onChange={e => setGuestId(e.target.value)}
              >
                <option value="">Select guest…</option>
                {guests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
              <select
                className="w-full rounded border px-3 py-2"
                value={status}
                onChange={e => setStatus(e.target.value)}
                disabled={!statuses.length}
              >
                {ALLOWED_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-40 rounded border px-3 py-2 text-sm"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g. 150"
            />
            <p className="mt-1 text-xs text-gray-500">Payment will be recorded automatically for this amount.</p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-600">Items</label>
            <div className="space-y-2">
              {items.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded border px-2 py-2 text-sm"
                    value={row.qty}
                    onChange={e => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <input
                    className="flex-1 rounded border px-3 py-2 text-sm"
                    placeholder="Item name"
                    value={row.name}
                    onChange={e => updateItem(i, { name: e.target.value })}
                  />
                  <button
                    onClick={() => removeRow(i)}
                    disabled={items.length === 1}
                    className="rounded border px-2 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                    title="Remove row"
                  >
                    –
                  </button>
                  {i === items.length - 1 && (
                    <button
                      onClick={addRow}
                      className="rounded border px-2 py-2 text-xs text-green-600 hover:bg-green-50"
                      title="Add row"
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Each row: quantity + item name (e.g. 3 Shirts). They will be combined automatically.</p>
          </div>

          <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Preview: {items.filter(r => r.name.trim()).length
              ? items.filter(r => r.name.trim() && r.qty > 0).map(r => `${r.qty} ${r.name.trim()}`).join(', ')
              : '—'}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
            disabled={submitting}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >{submitting ? 'Saving…' : 'Save Laundry'}</button>
        </div>
      </div>
    </div>
  );
}

export default function LaundryPage() {
  const [rows, setRows] = useState<Laundry[]>([]); const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''); const [status, setStatus] = useState<'All' | string>('All');
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ guestId: '', items: '', status: 'pending' });
  const [editError, setEditError] = useState('');
  const [justSaved, setJustSaved] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<string[]>([...ALLOWED_STATUSES]);
  const [statusesLoading, setStatusesLoading] = useState(false);

  useEffect(() => {
    if (justSaved != null) {
      const t = setTimeout(() => setJustSaved(null), 2000);
      return () => clearTimeout(t);
    }
  }, [justSaved]);

  const n = (d: any, k: string) => Array.isArray(d) ? d : (Array.isArray(d?.[k]) ? d[k] : []);
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [lr, gr] = await Promise.all([axios.get('/laundry'), axios.get('/guests')]);
      setRows(n(lr.data, 'laundry')); setGuests(n(gr.data, 'guests'));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatusesLoading(true);
      try {
        const res = await axios.get('/laundry/statuses');
        let list = res.data?.statuses ?? res.data;
        if (Array.isArray(list)) {
          list = list.filter((s: string) => ALLOWED_STATUSES.includes(s as any));
        } else {
          list = ALLOWED_STATUSES;
        }
        if (!cancelled && list.length) setStatuses(list);
      } catch {
        if (!cancelled) setStatuses([...ALLOWED_STATUSES]);
      } finally {
        if (!cancelled) setStatusesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status !== 'All' && !statuses.includes(status)) setStatus('All');
    if (editing && !statuses.includes(editForm.status) && statuses.length) {
      setEditForm(f => ({ ...f, status: statuses[0] }));
    }
  }, [statuses, status, editing, editForm.status]);

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    return rows.filter(r => {
      const inText = !t || r.items.toLowerCase().includes(t) || (r.guest?.name ?? '').toLowerCase().includes(t) || String(r.guestId).includes(t) || r.status.toLowerCase().includes(t);
      const inStatus = status === 'All' || r.status === status;
      return inText && inStatus;
    });
  }, [q, status, rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, totalPages); const start = (cur - 1) * pageSize; const slice = filtered.slice(start, start + pageSize);

  const handleCreated = (created: Laundry) => {
    const guest = guests.find(g => g.id === created.guestId);
    setRows(p => [{ ...created, guest }, ...p]);
  };

  const beginEdit = (r: Laundry) => { setEditing(r.id); setEditForm({ guestId: String(r.guestId), items: r.items, status: r.status }); };
  const cancelEdit = () => { setEditing(null); setEditForm({ guestId: '', items: '', status: 'pending' }); setEditError(''); };
  const saveEdit = async (id: number) => {
    if (!editForm.items.trim()) {
      setEditError('Items required');
      return;
    }
    if (!statuses.includes(editForm.status)) {
      setEditError('Invalid status');
      return;
    }
    setSubmitting(true);
    setEditError('');
    try {
      const payload = { items: editForm.items.trim(), status: editForm.status };
      const res = await axios.patch(`/laundry/${id}`, payload);
      const updated: Laundry = res.data?.laundry ?? res.data ?? { id, ...payload };
      const guest = guests.find(g => g.id === updated.guestId) || rows.find(r => r.id === id)?.guest;
      setRows(p => p.map(r => r.id === id ? { ...r, ...updated, guest } : r));
      setJustSaved(id);
      cancelEdit();
    } catch (e: any) {
      setEditError(e?.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };
  const remove = async (id: number) => { if (!confirm('Delete this record?')) return; try { await axios.delete(`/laundry/${id}`); setRows(p => p.filter(x => x.id !== id)); } catch { alert('Delete failed'); } };

  function fmt(createdAt: string | Date) {
    const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <RequireAuth roles={['admin', 'housekeeping', 'reception', 'manager']}>
      <Layout>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-teal-700">Laundry</h1>
          {typeof window !== 'undefined' && !location.pathname.startsWith('/dashboard') && (
            <Link
              href="/dashboard"
              className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
            >
              Dashboard
            </Link>
          )}
          <div className="ml-auto">
            <button
              onClick={() => setAddModalOpen(true)}
              className="rounded-md bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
            >
              + Add Laundry
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search by guest, items, status…" className="w-full rounded-md border px-3 py-2 sm:w-96" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status</label>
            <select className="rounded-md border px-2 py-2" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} disabled={statusesLoading}>
              <option value="All">All</option>
              {statuses.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Rows</label>
            <select
              className="rounded-md border px-2 py-2"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Table (moved out of the select; previously malformed) */}
        <div className="overflow-x-auto rounded bg-white shadow">
          {loading ? (
            <div className="p-6 text-gray-600">Loading…</div>
          ) : slice.length === 0 ? (
            <div className="p-6 text-gray-600">No laundry records.</div>
          ) : (
            <table className="min-w-full table-auto border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Guest</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Items</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.map(r => {
                  const isEditing = editing === r.id;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3">{r.guest?.name ?? `Guest #${r.guestId}`}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-1">
                            <textarea
                              className="w-full rounded-md border px-3 py-2"
                              value={editForm.items}
                              onChange={e => setEditForm(f => ({ ...f, items: e.target.value }))}
                              rows={3}
                            />
                            {editError && <div className="text-xs text-red-600">{editError}</div>}
                          </div>
                        ) : r.items}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            className="rounded-md border px-2 py-2"
                            value={editForm.status}
                            onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                          >
                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{r.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{fmt(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(r.id)}
                                disabled={submitting}
                                className="rounded-md border px-3 py-1 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded-md border px-3 py-1 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => beginEdit(r)}
                                className="rounded-md border px-3 py-1 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => remove(r.id)}
                                className="rounded-md border px-3 py-1 text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {justSaved === r.id && !isEditing && (
                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                              Saved
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <AddLaundryModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          guests={guests}
          onCreated={handleCreated}
          submitting={submitting}
          setSubmitting={setSubmitting}
          statuses={statuses}
        />
      </Layout>
    </RequireAuth>
  );
}
