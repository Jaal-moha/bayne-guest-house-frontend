import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import { Input, Select } from '@/components/Input';
import Panel from '@/components/Panel';
import Table from '@/components/Table';
import { useToast } from '@/components/Toast';
import { useList } from '@/lib/useList';
import { date, dateTime } from '@/lib/format';

type Attendance = {
  id: number;
  staffId: number;
  date: string | Date;
  checkIn: string | Date;
  checkOut?: string | Date | null;
  staff?: { name: string; role?: string | null };
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
      {err && <Alert className="mb-3">{err}</Alert>}
      <div className="space-y-3">
        <Field label="Check-in">
          {(id) => <Input id={id} type="datetime-local" className="font-mono tabular-nums" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />}
        </Field>
        <Field label="Check-out" error={fieldErr}>
          {(id) => <Input id={id} type="datetime-local" className="font-mono tabular-nums" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />}
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
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
      return staff.includes(term) || role.includes(term) || String(a.staffId).includes(term) || date(a.date).toLowerCase().includes(term);
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
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Attendance</h1>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search by staff, role, date…"
          className="sm:w-80"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Rows</label>
          <Select className="sm:w-auto" value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={curPage <= 1}>Prev</Button>
          <span className="text-sm text-muted tabular-nums">Page {curPage} / {totalPages}</span>
          <Button size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={curPage >= totalPages}>Next</Button>
        </div>
      </div>

      {/* Table */}
      <Panel className="overflow-x-auto">
        <ListState list={attendance} empty="No records.">
          {rows.length === 0 ? (
            <div className="p-6 text-muted">No records.</div>
          ) : (
          <Table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Role</th>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Hours</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.staff?.name ?? `#${r.staffId}`}</td>
                  <td>{r.staff?.role ?? '—'}</td>
                  <td className="font-mono text-sm whitespace-nowrap tabular-nums">{date(r.date)}</td>
                  <td className="font-mono text-sm whitespace-nowrap tabular-nums">{dateTime(r.checkIn)}</td>
                  <td className="font-mono text-sm whitespace-nowrap tabular-nums">{dateTime(r.checkOut)}</td>
                  <td className="font-mono text-sm tabular-nums">{hoursBetween(r.checkIn, r.checkOut)}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => setEditing(r)}>Edit</Button>
                      <Button size="sm" variant="danger-quiet" onClick={() => handleDelete(r.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          )}
        </ListState>
      </Panel>

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
