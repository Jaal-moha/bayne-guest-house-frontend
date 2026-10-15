import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import { Input, Select } from '@/components/Input';
import Panel from '@/components/Panel';
import StatusChip from '@/components/StatusChip';
import Table from '@/components/Table';
import { Plus } from '@phosphor-icons/react';
import ListState from '@/components/ListState';
import BookingFlow from '@/components/BookingFlow';
import { useList } from '@/lib/useList';
import { money, date } from '@/lib/format';

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
    <Modal open={open} onClose={onClose} title="Edit Booking" size="2xl" locked={loading}>
      {err && <Alert className="mt-3">{err}</Alert>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Guest" className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={`${booking.guest?.name ?? ''}${booking.guest?.phone ? ` — ${booking.guest.phone}` : ''}`}
              readOnly
              disabled
            />
          )}
        </Field>

        <Field label={<>Check-in {canEditCheckIn ? '' : '(read-only)'}</>}>
          {(id) => (
            <Input
              id={id}
              type="date"
              className="font-mono tabular-nums"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              readOnly={!canEditCheckIn}
              disabled={!canEditCheckIn}
              min={canEditCheckIn ? tomorrowYMD : undefined}
            />
          )}
        </Field>
        <Field label="Check-out">
          {(id) => (
            <Input
              id={id}
              type="date"
              className="font-mono tabular-nums"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || undefined}
            />
          )}
        </Field>

        <Field label={<>Available Rooms {checkIn && checkOut ? '' : <span className="font-normal text-muted">(select dates first)</span>}</>} className="sm:col-span-2">
          {(id) => (
            <Select
              id={id}
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
                      {r.number} — {r.type} — {money(r.price)}
                    </option>
                  ))}
                </>
              )}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={loading}>
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </Modal>
  );
}

function BookingsInner() {
  const bookings = useList<Booking>('bookings', async () => {
    const res = await axios.get('/bookings');
    return Array.isArray(res.data) ? res.data : res.data.bookings ?? [];
  });
  const { rows, setRows } = bookings;
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Booking | null>(null);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(b =>
      [
        b.guest?.name, b.room?.number, b.room?.type,
        date(b.checkIn),
        date(b.checkOut),
        b.payment ? 'paid' : 'unpaid',
      ].some(v => (v || '').toLowerCase().includes(t)),
    );
  }, [q, rows]);

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by guest, room, date…"
            className="sm:w-64"
          />
          <Button variant="primary" icon={Plus} onClick={() => setModal(true)}>
            Create Booking
          </Button>
        </div>
      </div>

      <Panel className="overflow-x-auto">
        <ListState list={bookings}>
          <Table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td className="font-semibold">{b.guest?.name}</td>
                  <td><span className="font-mono text-sm font-semibold tabular-nums">{b.room?.number}</span> — {b.room?.type}</td>
                  <td className="font-mono text-sm whitespace-nowrap tabular-nums">
                    {date(b.checkIn)} → {date(b.checkOut)}
                  </td>
                  <td>
                    <StatusChip status={b.payment ? 'paid' : 'unpaid'} />
                  </td>
                  <td>
                    <Button size="sm" onClick={() => setEdit(b)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="text-muted" colSpan={5}>No bookings.</td></tr>
              )}
            </tbody>
          </Table>
        </ListState>
      </Panel>

      <BookingFlow<Booking>
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
    <RequireAuth>
      <BookingsInner />
    </RequireAuth>
  );
}
