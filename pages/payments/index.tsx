import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import Link from 'next/link';

type Guest = { id: number; name: string };
type Room  = { id: number; number: string; type: string; price: number };

type Booking = {
  id: number;
  guest: Guest;
  room: Room;
  checkIn: string;
  checkOut: string;
  payment?: Payment | null; // was: any | null
};

type Payment = {
  id: number;
  amount: number;
  method: string;
  status: string;
  description?: string | null;
  createdAt: string;
  booking: Booking;
};

// Helper types/utilities to avoid `any`
type PaymentCreatePayload = {
  bookingId: number;
  method: string;
  status: string;
  amount?: number;
  description?: string;
};
const getErrMsg = (err: unknown) => {
  const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string };
  return e?.response?.data?.message || e?.message || 'Request failed';
};

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'mobile', label: 'Mobile Money' },
  { value: 'e_birr', label: 'E-birr' },
  { value: 'cbe', label: 'CBE Transfer' },
  { value: 'cbe_birr', label: 'CBEbirr Wallet' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const METHOD_LABEL_MAP = new Map(METHODS.map(m => [m.value, m.label]));

const STATUSES = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

function nightsBetween(inISO: string, outISO: string) {
  const a = new Date(inISO).getTime();
  const b = new Date(outISO).getTime();
  const n = Math.floor((b - a) / 86_400_000);
  return n <= 0 ? 1 : n;
}

function RecordPaymentModal({
  open, onClose, onCreated, presetBooking,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (p: Payment) => void;
  presetBooking?: Booking | null; // if provided, pre-select & lock booking
}) {
  const [unpaid, setUnpaid] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState<number | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('cash');
  const [status, setStatus] = useState<string>('paid');
  const [description, setDescription] = useState<string>('');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(''); setMethod('cash'); setStatus('paid'); setDescription(''); setErr('');

    if (presetBooking) {
      setBookingId(presetBooking.id);
      setUnpaid([presetBooking]); // keep dropdown simple (locked)
      return;
    }

    axios.get('/bookings', { params: { unpaid: 'true' } }).then(res => {
      const list = Array.isArray(res.data) ? res.data : res.data?.bookings ?? [];
      setUnpaid(list);
      setBookingId('');
    });
  }, [open, presetBooking]);

  if (!open) return null;

  const selected =
    presetBooking ??
    unpaid.find(b => b.id === bookingId);

  const computed = selected
    ? nightsBetween(selected.checkIn, selected.checkOut) * (selected.room?.price ?? 0)
    : null;

  const submit = async () => {
    setErr('');
    const idToUse = presetBooking?.id ?? bookingId;
    if (!idToUse) return setErr('Select a booking');
    try {
      setLoading(true);
      const payload: PaymentCreatePayload = {
        bookingId: Number(idToUse),
        method,
        status,
      };
      if (amount.trim()) payload.amount = Number(amount);
      if (description.trim()) payload.description = description.trim();
      const res = await axios.post('/payments', payload);
      onCreated(res.data);
      onClose();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Record Payment</h3>
        {err && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Booking</label>
            <select
              className="w-full rounded border px-3 py-2 disabled:bg-gray-100"
              value={presetBooking ? presetBooking.id : bookingId}
              onChange={e=>setBookingId(Number(e.target.value))}
              disabled={!!presetBooking}
            >
              {presetBooking ? (
                <option value={presetBooking.id}>
                  #{presetBooking.id} — {presetBooking.guest?.name} — Room {presetBooking.room?.number} (
                  {new Date(presetBooking.checkIn).toLocaleDateString()} → {new Date(presetBooking.checkOut).toLocaleDateString()})
                </option>
              ) : (
                <>
                  <option value="">Select unpaid booking…</option>
                  {unpaid.map(b => (
                    <option key={b.id} value={b.id}>
                      #{b.id} — {b.guest?.name} — Room {b.room?.number} (
                      {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {selected && (
            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
              Nights: <b>{nightsBetween(selected.checkIn, selected.checkOut)}</b> × Rate:{' '}
              <b>${selected.room?.price?.toFixed(2)}</b> = <b>${computed?.toFixed(2)}</b>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount (optional)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded border px-3 py-2"
              placeholder={selected && computed != null ? `${computed}` : 'e.g. 120'}
              value={amount}
              onChange={e=>setAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">Leave empty to use the calculated total.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Method</label>
              <select className="w-full rounded border px-3 py-2" value={method} onChange={e=>setMethod(e.target.value)}>
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select className="w-full rounded border px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description / Reason (optional)</label>
            <textarea
              className="w-full rounded border px-3 py-2"
              placeholder="e.g. Paid cash at reception; includes minibar charge"
              value={description}
              onChange={(e)=>setDescription(e.target.value)}
              rows={3}
              maxLength={300}
            />
            <p className="mt-1 text-xs text-gray-500">Max 300 characters.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {loading ? 'Saving…' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentsTab({
  rows, loading, q, setQ, openModal,
}: {
  rows: Payment[]; loading: boolean; q: string; setQ: (v: string)=>void; openModal: ()=>void;
}) {
  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(p =>
      [
        p.booking?.guest?.name,
        p.booking?.room?.number,
        p.method, p.status,
        p.description ?? '',
        String(p.amount),
        new Date(p.createdAt).toLocaleDateString(),
      ].some(v => (v || '').toLowerCase().includes(t)),
    );
  }, [q, rows]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Payments</h1>
        {typeof window !== 'undefined' && !location.pathname.startsWith('/dashboard') && (
          <Link
            href="/dashboard"
            className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        )}
        <div className="ml-auto flex gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="w-64 rounded border px-3 py-2" />
          <button onClick={openModal} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white">Record Payment</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded bg-white shadow">
        {loading ? <div className="p-6 text-gray-600">Loading…</div> : (
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Booking</th>
                <th className="px-4 py-3 text-left">Guest</th>
                <th className="px-4 py-3 text-left">Room</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">#{p.booking?.id}</td>
                  <td className="px-4 py-3">{p.booking?.guest?.name}</td>
                  <td className="px-4 py-3">{p.booking?.room?.number} — {p.booking?.room?.type}</td>
                  <td className="px-4 py-3">${p.amount.toFixed(2)}</td>
                  <td className="px-4 py-3">{METHOD_LABEL_MAP.get(p.method) ?? p.method.replace('_', ' ')}</td>
                  <td className="px-4 py-3 capitalize">{p.status}</td>
                  <td className="px-4 py-3">
                    {p.description
                      ? <span title={p.description}>
                          {p.description.length > 60 ? p.description.slice(0,60) + '…' : p.description}
                        </span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td className="px-4 py-6 text-gray-500" colSpan={8}>No payments.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function UnpaidTab({
  rows, loading, q, setQ, openForBooking,
}: {
  rows: Booking[]; loading: boolean; q: string; setQ: (v: string)=>void; openForBooking: (b: Booking)=>void;
}) {
  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(b =>
      [
        b.guest?.name,
        b.room?.number,
        b.room?.type,
        new Date(b.checkIn).toLocaleDateString(),
        new Date(b.checkOut).toLocaleDateString(),
      ].some(v => (v || '').toLowerCase().includes(t)),
    );
  }, [q, rows]);

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Unpaid Bookings</h1>
        <div className="ml-auto flex gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="w-64 rounded border px-3 py-2" />
        </div>
      </div>

      <div className="overflow-x-auto rounded bg-white shadow">
        {loading ? <div className="p-6 text-gray-600">Loading…</div> : (
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Booking</th>
                <th className="px-4 py-3 text-left">Guest</th>
                <th className="px-4 py-3 text-left">Room</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-left">Nights × Rate</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b=> {
                const nights = nightsBetween(b.checkIn, b.checkOut);
                const total = nights * (b.room?.price ?? 0);
                return (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-3">#{b.id}</td>
                    <td className="px-4 py-3">{b.guest?.name}</td>
                    <td className="px-4 py-3">{b.room?.number} — {b.room?.type}</td>
                    <td className="px-4 py-3">
                      {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{nights} × ${b.room?.price?.toFixed(2)} = <b>${total.toFixed(2)}</b></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={()=>openForBooking(b)}
                        className="rounded bg-indigo-600 px-3 py-1.5 font-semibold text-white"
                      >
                        Record
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && <tr><td className="px-4 py-6 text-gray-500" colSpan={6}>No unpaid bookings.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function PaymentsInner() {
  const [tab, setTab] = useState<'payments'|'unpaid'>('payments');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaid, setUnpaid] = useState<Booking[]>([]);
  const [loadingPay, setLoadingPay] = useState(true);
  const [loadingUnpaid, setLoadingUnpaid] = useState(true);

  const [qPay, setQPay] = useState('');
  const [qUnpaid, setQUnpaid] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [presetBooking, setPresetBooking] = useState<Booking | null>(null);

  const [unauthorized, setUnauthorized] = useState(false);

  // Load payments
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/payments');
        setPayments(Array.isArray(res.data) ? res.data : res.data?.payments ?? []);
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setUnauthorized(true);
        }
      } finally {
        setLoadingPay(false);
      }
    })();
  }, []);

  // Load unpaid bookings
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/bookings', { params: { unpaid: 'true' } });
        setUnpaid(Array.isArray(res.data) ? res.data : res.data?.bookings ?? []);
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setUnauthorized(true);
        }
      } finally {
        setLoadingUnpaid(false);
      }
    })();
  }, []);

  const openNewPayment = () => { setPresetBooking(null); setModalOpen(true); };
  const openForBooking = (b: Booking) => { setPresetBooking(b); setModalOpen(true); };

  const onCreated = (p: Payment) => {
    // Add to payments list
    setPayments(prev => [p, ...prev]);
    // Remove booking from unpaid
    setUnpaid(prev => prev.filter(b => b.id !== p.booking.id));
  };

  return (
    <Layout>
      {unauthorized && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You do not have permission to view full payment data. (403)
        </div>
      )}
      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b">
        <button
          onClick={()=>setTab('payments')}
          className={`-mb-px rounded-t px-4 py-2 ${tab==='payments' ? 'border-b-2 border-indigo-600 font-semibold' : 'text-gray-600'}`}
          disabled={unauthorized}
        >
          Payments
        </button>
        <button
          onClick={()=>setTab('unpaid')}
          className={`-mb-px rounded-t px-4 py-2 ${tab==='unpaid' ? 'border-b-2 border-indigo-600 font-semibold' : 'text-gray-600'}`}
          disabled={unauthorized}
        >
          Unpaid Bookings
        </button>
      </div>

      {unauthorized ? (
        <div className="rounded bg-white p-6 text-gray-600 shadow">
          Limited access. Contact an administrator if this is unexpected.
        </div>
      ) : (
        <>
          {tab === 'payments' ? (
            <PaymentsTab
              rows={payments}
              loading={loadingPay}
              q={qPay}
              setQ={setQPay}
              openModal={openNewPayment}
            />
          ) : (
            <UnpaidTab
              rows={unpaid}
              loading={loadingUnpaid}
              q={qUnpaid}
              setQ={setQUnpaid}
              openForBooking={openForBooking}
            />
          )}
        </>
      )}

      <RecordPaymentModal
        open={modalOpen && !unauthorized}
        onClose={()=>setModalOpen(false)}
        onCreated={onCreated}
        presetBooking={presetBooking}
      />
    </Layout>
  );
}

export default function PaymentsPage() {
  return (
    <RequireAuth roles={['admin','finance','reception','manager']}>
      <PaymentsInner />
    </RequireAuth>
  );
}
