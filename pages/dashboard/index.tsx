// pages/dashboard/index.tsx
import { useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import axios from '@/utils/axiosInstance';
import BookingFlow from '@/components/BookingFlow';
import ListState from '@/components/ListState';
import { useList } from '@/lib/useList';
import { money } from '@/lib/format';

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

function StatCard({ label, value }: { label: string; value: number | string; }) {
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
    guests: n(r?.guests),
    bookings: n(r?.bookings),
    rooms: n(r?.rooms),
    payments: n(r?.payments),
    staff: n(r?.staff),
    inventory: n(r?.inventory),
    laundry: n(r?.laundry),
    revenue: n(r?.revenue),
  };
}

const integer = (v: number) => Number(v).toLocaleString();

function DashboardInner() {
  const [showStepper, setShowStepper] = useState(false);

  const { user, loading: authLoading } = useAuth();

  // date range state (ISO yyyy-mm-dd)
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [applied, setApplied] = useState<{ start?: string; end?: string; }>({});

  const overview = useList<Stats>('dashboard stats', async () => {
    const params: Record<string, string> = {};
    if (applied.start) params.start = applied.start;
    if (applied.end) params.end = applied.end;
    const res = await axios.get('/stats/overview', { params });
    return [normalizeStats(res.data)];
  }, JSON.stringify(applied));
  const [stats] = overview.rows;

  function applyRange() {
    const next = { start: startDate, end: endDate };
    if (JSON.stringify(next) === JSON.stringify(applied)) overview.reload();
    else setApplied(next);
  }

  function clearRange() {
    setStartDate(undefined);
    setEndDate(undefined);
    setApplied({});
  }

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="ml-auto">
          {/* Only allow receptionists and managers to create bookings from dashboard */}
          {(!authLoading && (user?.role === 'reception' || user?.role === 'manager')) && (
            <button onClick={() => setShowStepper(true)} className="rounded bg-indigo-600 px-3 py-1 text-white">New Booking</button>
          )}
        </div>
      </div>

      <BookingFlow open={showStepper} onClose={() => setShowStepper(false)} onCreated={overview.reload} />


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

      <ListState list={overview} empty="No stats available.">
        {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Guests" value={integer(stats.guests)} />
          <StatCard label="Bookings" value={integer(stats.bookings)} />
          <StatCard label="Rooms" value={integer(stats.rooms)} />
          <StatCard label="Payments" value={integer(stats.payments)} />
          <StatCard label="Staff" value={integer(stats.staff)} />
          <StatCard label="Inventory Items" value={integer(stats.inventory)} />
          <StatCard label="Laundry" value={integer(stats.laundry)} />
          <StatCard label="Revenue" value={money(stats.revenue)} />
        </div>
        )}
      </ListState>
    </Layout>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}
