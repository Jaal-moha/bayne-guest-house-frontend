import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import axios from '@/utils/axiosInstance';

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

// Build full API URL using NEXT_PUBLIC_API_BASE_URL when set
const apiUrl = (path: string) => {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
  return `${base}${path}`;
};

export default function AttendancePage() {
  const [rowsAll, setRowsAll] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async () => {
    try {
      const res = await axios.get(apiUrl('/attendance'));
      const data = Array.isArray(res.data) ? res.data : res.data.attendance ?? [];
      setRowsAll(data);
    } catch (e) {
      console.error('Fetch attendance failed', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

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
      await axios.delete(apiUrl(`/attendance/${id}`));
      setRowsAll(prev => prev.filter(r => r.id !== id));
    } catch {
      alert('Delete failed.');
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
        <div className="ml-auto flex items-center gap-2">
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
        {loading ? (
          <div className="p-6 text-gray-600">Loading...</div>
        ) : rows.length === 0 ? (
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
                      <button className="rounded-md border px-3 py-1 hover:bg-gray-50">Edit</button>
                      <button onClick={() => handleDelete(r.id)}
                              className="rounded-md border px-3 py-1 text-red-600 hover:bg-red-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
