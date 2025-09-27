// pages/dashboard/index.tsx
import { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';

type Stats = {
  guests: number;
  bookings: number;
  rooms: number;
  payments: number;
  staff: number;
  inventory: number;
  laundry: number;
  revenue: number; // normalized to number in code below
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

// Coerce unknown/raw payload into the Stats shape with numbers
function normalizeStats(raw: unknown): Stats {
  const n = (v: unknown) => {
    const num = Number(v);
    return Number.isFinite(num) ? num : 0;
  };
  const r = raw as Record<string, unknown> | null | undefined;
  return {
    guests:    n(r?.guests),
    bookings:  n(r?.bookings),
    rooms:     n(r?.rooms),
    payments:  n(r?.payments),
    staff:     n(r?.staff),
    inventory: n(r?.inventory),
    laundry:   n(r?.laundry),
    revenue:   n(r?.revenue),
  };
}

const money = (v: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);

const integer = (v: number) => Number(v).toLocaleString();

function DashboardInner() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // date range state (ISO yyyy-mm-dd)
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // helper to extract readable error message
  const getErrMsg = (e: unknown) =>
    (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
    || (e as { message?: string })?.message
    || 'Failed to load stats';

  // fetch overview, optional range object with start/end (yyyy-mm-dd)
  const fetchOverview = useCallback(async (range?: { start?: string; end?: string }) => {
    setLoading(true);
    setErrMsg(null);
    try {
      const params: Record<string, string> = {};
      if (range?.start) params.start = range.start;
      if (range?.end) params.end = range.end;
      const res = await axios.get('/stats/overview', { params });
      setStats(normalizeStats(res.data));
    } catch (e: unknown) {
      console.error('Stats fetch failed', e);
      setErrMsg(getErrMsg(e));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  function applyRange() {
    // if neither provided -> lifetime
    if (!startDate && !endDate) {
      fetchOverview();
      return;
    }
    fetchOverview({ start: startDate, end: endDate });
  }

  function clearRange() {
    setStartDate(undefined);
    setEndDate(undefined);
    fetchOverview();
  }

  return (
    <Layout>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Dashboard</h1>

      {/* Range controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>Start</span>
          <input
            type="date"
            value={startDate ?? ''}
            onChange={(e) => setStartDate(e.target.value || undefined)}
            className="rounded border px-2 py-1"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>End</span>
          <input
            type="date"
            value={endDate ?? ''}
            onChange={(e) => setEndDate(e.target.value || undefined)}
            className="rounded border px-2 py-1"
          />
        </label>

        <button onClick={applyRange} className="ml-2 rounded bg-blue-600 px-3 py-1 text-white">
          Apply
        </button>
        <button onClick={clearRange} className="ml-2 rounded border px-3 py-1">
          Clear (lifetime)
        </button>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : errMsg ? (
        <div className="text-red-600">{errMsg}</div>
      ) : !stats ? (
        <div className="text-gray-600">No stats available.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Guests"           value={integer(stats.guests)} />
          <StatCard label="Bookings"         value={integer(stats.bookings)} />
          <StatCard label="Rooms"            value={integer(stats.rooms)} />
          <StatCard label="Payments"         value={integer(stats.payments)} />
          <StatCard label="Staff"            value={integer(stats.staff)} />
          <StatCard label="Inventory Items"  value={integer(stats.inventory)} />
          <StatCard label="Laundry"          value={integer(stats.laundry)} />
          <StatCard label="Revenue"          value={money(stats.revenue)} />
        </div>
      )}
    </Layout>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth roles={['admin','manager','reception','finance']}>
      <DashboardInner />
    </RequireAuth>
  );
}
