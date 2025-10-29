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

function EditBookingModal({
  open, booking, onClose, onUpdated,
}: {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  onUpdated: (b: Booking) => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<number | ''>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const { push } = useToast();

  // Helpers for date handling
  const toYMD = (d: string | Date) => {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const tomorrowYMD = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 1);
    return toYMD(t);
  }, []);
  const canEditCheckIn = useMemo(() => {
    if (!booking) return false;
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const tomorrow = new Date(t);
    tomorrow.setDate(t.getDate() + 1);
    const currentCheckIn = new Date(booking.checkIn);
    currentCheckIn.setHours(0, 0, 0, 0);
    return currentCheckIn >= tomorrow; // editable only if current check-in is at least +1 day in future
  }, [booking]);

  // Hydrate when opening
  useEffect(() => {
    if (!open || !booking) return;
    setErr('');
    setRooms([]);
    setRoomId(booking.room?.id ?? '');
    setCheckIn(toYMD(booking.checkIn));
    setCheckOut(toYMD(booking.checkOut));
  }, [open, booking]);

  // Fetch available rooms when dates change
  useEffect(() => {
    const fetchAvailable = async () => {
      setRooms([]);
      if (!checkIn || !checkOut) return;
      try {
        const res = await axios.get('/rooms/available', { params: { checkIn, checkOut } });
        let list: Room[] = Array.isArray(res.data) ? res.data : res.data.rooms ?? res.data;
        // Ensure current room is present even if availability excludes it for overlapping (editing same booking)
        if (booking?.room && !list.find(r => r.id === booking.room.id)) {
          list = [booking.room, ...list];
        }
        setRooms(list);
        if (roomId && !list.find((r: Room) => r.id === roomId)) setRoomId('');
      } catch (e: any) {
        setErr(e?.response?.data?.message || 'Failed to load available rooms');
      }
    };
    if (open) fetchAvailable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, open]);

  const submit = async () => {
    setErr('');
    if (!booking) return;
    if (!checkOut) return setErr('Select check-out');
    if (canEditCheckIn && checkIn < tomorrowYMD) return setErr('Check-in must be at least tomorrow');
    if (!roomId) return setErr('Select a room');
    try {
      setLoading(true);
      const payload: any = { roomId, checkOut: new Date(checkOut) };
      if (canEditCheckIn) payload.checkIn = new Date(checkIn);
      const res = await axios.patch(`/bookings/${booking.id}`, payload);
      const updated = res.data;
      onUpdated(updated);
      try { push('Booking updated successfully', 'success'); } catch (e) { /* noop */ }
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update booking';
      setErr(msg);
      try { push(msg, 'error'); } catch (er) { /* noop */ }
    } finally {
      setLoading(false);
    }
  };

  if (!open || !booking) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Edit Booking</h3>
        {err && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Guest</label>
            <input
              className="w-full rounded border bg-gray-50 px-3 py-2 text-gray-700"
              value={`${booking.guest?.name ?? ''}${booking.guest?.phone ? ` — ${booking.guest.phone}` : ''}`}
              readOnly
              disabled
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Check-in {canEditCheckIn ? '' : '(read-only)'}</label>
            <input
              type="date"
              className={`w-full rounded border px-3 py-2 ${canEditCheckIn ? '' : 'bg-gray-50 text-gray-700'}`}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              readOnly={!canEditCheckIn}
              disabled={!canEditCheckIn}
              min={canEditCheckIn ? tomorrowYMD : undefined}
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
            className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [edit, setEdit] = useState<Booking | null>(null);

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
                <th className="px-4 py-3 text-left">Actions</th>
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
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEdit(b)}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={5}>No bookings.</td></tr>
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

      <EditBookingModal
        open={!!edit}
        booking={edit}
        onClose={() => setEdit(null)}
        onUpdated={(b) => setRows(prev => prev.map(x => x.id === b.id ? b : x))}
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
