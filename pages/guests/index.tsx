import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';

type Guest = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
};

type Room = {
  id: number;
  number: string;
  type?: string;
  rate: number; // per night
};

type Booking = {
  id: number;
  guestId: number;
  roomId: number;
  from: string;
  to: string;
  nights: number;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  room?: Room;
  guest?: Guest;
};

/* -------------------- Add Guest Modal -------------------- */
function AddGuestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (g: Guest) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setEmail('');
      setErr('');
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setErr('');
    if (!name.trim()) return setErr('Name is required');
    try {
      setLoading(true);
      const res = await axios.post('/guests', {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      onCreated(res.data);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to add guest';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Add Guest</h3>
        <p className="mt-1 text-sm text-gray-500">Create a new guest profile</p>

        {err && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
            <input className="w-full rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input className="w-full rounded-md border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input className="w-full rounded-md border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
            {loading ? 'Saving…' : 'Add Guest'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Payment Modal -------------------- */
function PaymentModal({
  open,
  booking,
  onClose,
  onPaid,
}: {
  open: boolean;
  booking?: Booking | null;
  onClose: () => void;
  onPaid: (b: Booking) => void;
}) {
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setCardName('');
      setCardNumber('');
      setErr('');
      setLoading(false);
    }
  }, [open]);

  if (!open || !booking) return null;

  const submit = async () => {
    setErr('');
    if (!cardName.trim() || !cardNumber.trim()) return setErr('Card name and number are required');
    try {
      setLoading(true);
      const res = await axios.post('/payments', {
        bookingId: booking.id,
        method: 'card',
        details: { cardName: cardName.trim(), cardNumber: cardNumber.trim() },
      });
      // assume res.data is the updated booking
      onPaid(res.data);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Payment failed';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Pay for Booking</h3>
        <p className="mt-1 text-sm text-gray-500">Booking #{booking.id} — Amount: {booking.amount.toFixed(2)}</p>

        {err && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name on card</label>
            <input className="w-full rounded-md border px-3 py-2" value={cardName} onChange={(e) => setCardName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Card number</label>
            <input className="w-full rounded-md border px-3 py-2" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded-md bg-green-600 px-4 py-2 text-white">
            {loading ? 'Processing…' : `Pay ${booking.amount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Booking Modal -------------------- */
function BookingModal({
  open,
  guest,
  onClose,
  onBooked,
  onPaymentRequested,
}: {
  open: boolean;
  guest?: Guest | null;
  onClose: () => void;
  onBooked: (b: Booking) => void;
  onPaymentRequested: (b: Booking) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<number | ''>('');
  const [err, setErr] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setFrom('');
      setTo('');
      setRoomId('');
      setRooms([]);
      setErr('');
    }
  }, [open]);

  if (!open) return null;

  const fetchRooms = async (f?: string, t?: string) => {
    setLoadingRooms(true);
    try {
      // backend should filter by availability for the date range
      const res = await axios.get('/rooms/available', { params: { from: f, to: t } });
      setRooms(Array.isArray(res.data) ? res.data : res.data?.rooms ?? []);
    } catch (e) {
      console.error('Failed to fetch rooms', e);
      setErr('Failed to fetch available rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  const nightsBetween = (f: string, t: string) => {
    if (!f || !t) return 0;
    const a = new Date(f);
    const b = new Date(t);
    const ms = b.getTime() - a.getTime();
    const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    return days;
  };

  const selectedRoom = rooms.find((r) => r.id === roomId);

  const handleCheckAvailability = () => {
    setErr('');
    if (!from || !to) return setErr('Select both from and to dates');
    fetchRooms(from, to);
  };

  const createBooking = async () => {
    setErr('');
    if (!guest) return setErr('No guest selected');
    if (!from || !to) return setErr('Select dates');
    if (!roomId) return setErr('Select a room');
    const nights = nightsBetween(from, to);
    const rate = selectedRoom?.rate ?? 0;
    const amount = nights * rate;
    try {
      setCreating(true);
      const res = await axios.post('/bookings', {
        guestId: guest.id,
        roomId,
        from,
        to,
        nights,
        amount,
      });
      const booking: Booking = res.data;
      onBooked(booking);
      // request payment if booking pending
      if (booking.status === 'pending') {
        onPaymentRequested(booking);
      }
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to create booking';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Book Room for {guest?.name}</h3>
        <p className="mt-1 text-sm text-gray-500">Select dates and an available room</p>

        {err && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleCheckAvailability} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
              Check Availability
            </button>
            {loadingRooms && <span className="text-sm text-gray-600">Checking…</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Available Rooms</label>
            <select value={String(roomId)} onChange={(e) => setRoomId(Number(e.target.value) || '')} className="w-full rounded-md border px-3 py-2">
              <option value="">Select a room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} — {r.type ?? 'room'} — {r.rate.toFixed(2)}/night
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-700">
            Nights: {nightsBetween(from, to)} · Rate: {selectedRoom ? selectedRoom.rate.toFixed(2) : '0.00'} · Total:{' '}
            {(nightsBetween(from, to) * (selectedRoom?.rate ?? 0)).toFixed(2)}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-4 py-2">Cancel</button>
          <button onClick={createBooking} disabled={creating} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
            {creating ? 'Booking…' : 'Create Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Guests Page -------------------- */
export default function GuestsPageInner() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const [addOpen, setAddOpen] = useState(false);

  // booking/payment state
  const [bookingOpenFor, setBookingOpenFor] = useState<Guest | undefined>(undefined);
  const [paymentOpenBooking, setPaymentOpenBooking] = useState<Booking | undefined>(undefined);

  const fetchGuests = async () => {
    try {
      const res = await axios.get('/guests');
      setGuests(Array.isArray(res.data) ? res.data : res.data?.guests ?? []);
    } catch (e) {
      console.error('Failed to fetch guests', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((g) => [g.name, g.phone ?? '', g.email ?? ''].some((v) => (v || '').toLowerCase().includes(term)));
  }, [q, guests]);

  const onCreated = (g: Guest) => setGuests((p) => [g, ...p]);

  // const openBooking = (g: Guest) => setBookingOpenFor(g);

  const onBooked = (b: Booking) => {
    // could store bookings if needed; for now show notification and open payment if pending
    alert(`Booking created (#${b.id}) — amount ${b.amount.toFixed(2)}`);
  };

  const onPaymentRequested = (b: Booking) => {
    setPaymentOpenBooking(b);
  };

  const onPaid = (updatedBooking: Booking) => {
    setPaymentOpenBooking(undefined);
    alert(`Payment successful for booking #${updatedBooking.id}`);
    // optionally refresh guests/bookings/rooms
  };

  return (
    <RequireAuth roles={['admin', 'manager', 'reception']}>
      <Layout>
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Guests</h1>
          <div className="ml-auto flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests…" className="w-64 rounded-md border px-3 py-2" />
            <button onClick={() => setAddOpen(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-white">Add Guest</button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg bg-white p-6 text-gray-600 shadow">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-gray-600 shadow">No guests found.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="px-4 py-3">{g.name}</td>
                    <td className="px-4 py-3">{g.phone || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">{g.email || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setAddOpen(true); /* could open edit if implemented */ }} className="rounded border px-3 py-1 text-xs font-semibold text-gray-700">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AddGuestModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={onCreated} />

        <BookingModal
          open={Boolean(bookingOpenFor)}
          guest={bookingOpenFor}
          onClose={() => setBookingOpenFor(undefined)}
          onBooked={onBooked}
          onPaymentRequested={onPaymentRequested}
        />

        <PaymentModal open={Boolean(paymentOpenBooking)} booking={paymentOpenBooking} onClose={() => setPaymentOpenBooking(undefined)} onPaid={onPaid} />
      </Layout>
    </RequireAuth>
  );
}
