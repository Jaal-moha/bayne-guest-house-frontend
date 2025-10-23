import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import { useToast } from '@/components/Toast';

type Guest = { id: number; name: string; phone: string; email?: string | null; };
type Room = { id: number; number: string; type: string; price: number; };
type Booking = {
  id: number;
  guest: Guest;
  room: Room;
  checkIn: string;
  checkOut: string;
  payment?: any | null;
};

function CreateBookingModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (b: Booking) => void;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guestId, setGuestId] = useState<number | ''>('');
  const [roomId, setRoomId] = useState<number | ''>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const { push } = useToast();

  // Load guests once when modal opens
  useEffect(() => {
    if (!open) return;
    setGuestId(''); setRoomId(''); setCheckIn(''); setCheckOut(''); setErr('');
    axios.get('/guests').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.guests ?? [];
      setGuests(data);
    });
  }, [open]);

  // Whenever dates change, fetch available rooms
  useEffect(() => {
    const fetchAvailable = async () => {
      setRooms([]);
      if (!checkIn || !checkOut) return;
      try {
        const res = await axios.get('/rooms/available', { params: { checkIn, checkOut } });
        const list = Array.isArray(res.data) ? res.data : res.data.rooms ?? res.data;
        setRooms(list);
        if (roomId && !list.find((r: Room) => r.id === roomId)) setRoomId('');
      } catch (e: any) {
        setErr(e?.response?.data?.message || 'Failed to load available rooms');
      }
    };
    fetchAvailable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut]);

  const submit = async () => {
    setErr('');
    if (!guestId) return setErr('Select a guest');
    if (!checkIn || !checkOut) return setErr('Select check-in and check-out');
    if (!roomId) return setErr('Select a room');
    try {
      setLoading(true);
      const res = await axios.post('/bookings', {
        guestId, roomId, checkIn: new Date(checkIn), checkOut: new Date(checkOut),
      });
      onCreated(res.data);
      try { push('Booking created successfully', 'success'); } catch (e) { /* noop */ }
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to create booking';
      setErr(msg);
      try { push(msg, 'error'); } catch (er) { /* noop */ }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Create Booking</h3>
        {err && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Guest</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={guestId}
              onChange={(e) => setGuestId(Number(e.target.value))}
            >
              <option value="">Select guest…</option>
              {guests.map(g => <option key={g.id} value={g.id}>{g.name} — {g.phone}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Check-in</label>
            <input
              type="date"
              className="w-full rounded border px-3 py-2"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Check-out</label>
            <input
              type="date"
              className="w-full rounded border px-3 py-2"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || undefined}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Available Rooms {checkIn && checkOut ? '' : <span className="text-gray-400">(select dates first)</span>}
            </label>
            <select
              className="w-full rounded border px-3 py-2"
              value={roomId}
              onChange={(e) => setRoomId(Number(e.target.value))}
              disabled={!checkIn || !checkOut || rooms.length === 0}
            >
              {!checkIn || !checkOut ? (
                <option value="">Select dates first</option>
              ) : rooms.length === 0 ? (
                <option value="">No rooms available</option>
              ) : (
                <>
                  <option value="">Select room…</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.number} — {r.type} — ${r.price.toFixed(2)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingsInner() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const fetchRows = async () => {
    try {
      const res = await axios.get('/bookings');
      const data = Array.isArray(res.data) ? res.data : res.data.bookings ?? [];
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(b =>
      [
        b.guest?.name, b.room?.number, b.room?.type,
        new Date(b.checkIn).toLocaleDateString(),
        new Date(b.checkOut).toLocaleDateString(),
        b.payment ? 'paid' : 'unpaid',
      ].some(v => (v || '').toLowerCase().includes(t)),
    );
  }, [q, rows]);

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="ml-auto flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by guest, room, date…"
            className="w-64 rounded border px-3 py-2"
          />
          <button
            onClick={() => setModal(true)}
            className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white"
          >
            Create Booking
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded bg-white shadow">
        {loading ? (
          <div className="p-6 text-gray-600">Loading…</div>
        ) : (
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Guest</th>
                <th className="px-4 py-3 text-left">Room</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-3">{b.guest?.name}</td>
                  <td className="px-4 py-3">{b.room?.number} — {b.room?.type}</td>
                  <td className="px-4 py-3">
                    {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {b.payment ? (
                      <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">Paid</span>
                    ) : (
                      <span className="rounded bg-yellow-100 px-2 py-1 text-yellow-800">Unpaid</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={4}>No bookings.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <CreateBookingModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={(b) => setRows(prev => [b, ...prev])}
      />
    </Layout>
  );
}

export default function BookingsPage() {
  return (
    <RequireAuth roles={['admin', 'reception', 'manager']}>
      <BookingsInner />
    </RequireAuth>
  );
}
