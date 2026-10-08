import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import { useToast } from '@/components/Toast';
import { useList } from '@/lib/useList';

type Attendance = {
  id: number;
  staffId: number;
  date: string | Date;
  checkIn: string | Date;
  checkOut?: string | Date | null;
  staff?: { name: string; role?: string | null };
};

const fmtDateTime = (d?: string | Date | null) => {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString();
};
const fmtDate = (d: string | Date) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleDateString();
};
const hoursBetween = (a: string | Date, b?: string | Date | null) => {
  const start = new Date(a);
  const end = b ? new Date(b) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const hrs = (end.getTime() - start.getTime()) / 36e5;
  return hrs < 0 ? '—' : hrs.toFixed(2);
};

// datetime-local inputs take local wall time, so shift the ISO string by the zone offset.
const toLocalInput = (d?: string | Date | null) => {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : new Date(x.getTime() - x.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function EditAttendanceModal({
  record, onClose, onSaved,
}: {
  record: Attendance | null;
  onClose: () => void;
  onSaved: (a: Attendance) => void;
}) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [fieldErr, setFieldErr] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setCheckIn(toLocalInput(record.checkIn));
    setCheckOut(toLocalInput(record.checkOut));
    setFieldErr('');
    setErr('');
  }, [record]);

  if (!record) return null;

  const submit = async () => {
    setErr('');
    if (!checkIn) return setFieldErr('Check-in is required');
    if (checkOut && new Date(checkOut) <= new Date(checkIn)) return setFieldErr('Check-out must be after check-in');
    setFieldErr('');
    try {
      setSaving(true);
      const res = await axios.patch(`/attendance/${record.id}`, {
        checkIn: new Date(checkIn).toISOString(),
        checkOut: checkOut ? new Date(checkOut).toISOString() : undefined,
      });
      onSaved({ ...record, ...res.data, staff: record.staff });
      onClose();
    } catch (e: unknown) {
      setErr(isAxiosError(e) ? e.response?.data?.message ?? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit attendance, ${record.staff?.name ?? `#${record.staffId}`}`} size="md" locked={saving}>
      {err && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="space-y-3">
        <Field label="Check-in">
          {(id) => <input id={id} type="datetime-local" className="w-full rounded-md border px-3 py-2" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />}
        </Field>
        <Field label="Check-out" error={fieldErr}>
          {(id) => <input id={id} type="datetime-local" className="w-full rounded-md border px-3 py-2" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />}
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} disabled={saving} className="rounded-md border px-4 py-2 hover:bg-gray-50">Cancel</button>
        <button onClick={submit} disabled={saving} className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

function AttendanceInner() {
  const attendance = useList<Attendance>('attendance records', async () => {
    const res = await axios.get('/attendance');
    return Array.isArray(res.data) ? res.data : res.data.attendance ?? [];
  });
  const { rows: rowsAll, setRows: setRowsAll } = attendance;
  const { push } = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Attendance | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rowsAll;
    return rowsAll.filter(a => {
      const staff = (a.staff?.name ?? '').toLowerCase();
      const role = (a.staff?.role ?? '').toLowerCase();
      return staff.includes(term) || role.includes(term) || String(a.staffId).includes(term) || fmtDate(a.date).toLowerCase().includes(term);
    });
  }, [q, rowsAll]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const start = (curPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this attendance record?')) return;
    try {
      await axios.delete(`/attendance/${id}`);
      setRowsAll(prev => prev.filter(r => r.id !== id));
    } catch {
      push('Delete failed.', 'error');
    }
  };

  return (
    <Layout>
      <h1 className="mb-4 text-2xl font-bold text-indigo-700">Attendance</h1>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search by staff, role, date…"
          className="w-full rounded-md border px-3 py-2 sm:w-80"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows</label>
          <select className="rounded-md border px-2 py-2" value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="rounded-md border px-3 py-2 disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={curPage <= 1}>Prev</button>
          <span className="text-sm text-gray-600">Page {curPage} / {totalPages}</span>
          <button className="rounded-md border px-3 py-2 disabled:opacity-50"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={curPage >= totalPages}>Next</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <ListState list={attendance} empty="No records.">
          {rows.length === 0 ? (
            <div className="p-6 text-gray-600">No records.</div>
          ) : (
          <table className="min-w-full table-auto border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Staff</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Check-in</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Check-out</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Hours</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.staff?.name ?? `#${r.staffId}`}</td>
                  <td className="px-4 py-3">{r.staff?.role ?? '—'}</td>
                  <td className="px-4 py-3">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3">{fmtDateTime(r.checkIn)}</td>
                  <td className="px-4 py-3">{fmtDateTime(r.checkOut)}</td>
                  <td className="px-4 py-3">{hoursBetween(r.checkIn, r.checkOut)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditing(r)} className="rounded-md border px-3 py-1 hover:bg-gray-50">Edit</button>
                      <button onClick={() => handleDelete(r.id)}
                              className="rounded-md border px-3 py-1 text-red-600 hover:bg-red-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </ListState>
      </div>

      <EditAttendanceModal
        record={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => setRowsAll(prev => prev.map(r => r.id === saved.id ? saved : r))}
      />
    </Layout>
  );
}

export default function AttendancePage() {
  return (
    <RequireAuth>
      <AttendanceInner />
    </RequireAuth>
  );
}
