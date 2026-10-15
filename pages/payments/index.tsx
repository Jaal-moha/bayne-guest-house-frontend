import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import Alert from '@/components/Alert';
import Button, { buttonClass } from '@/components/Button';
import { Input, Select, Textarea } from '@/components/Input';
import Panel from '@/components/Panel';
import { Chip } from '@/components/StatusChip';
import Table from '@/components/Table';
import { Plus } from '@phosphor-icons/react';
import { useList, type List } from '@/lib/useList';
import { money, date, dateTime } from '@/lib/format';
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
  booking?: Booking | null;
  guest?: Guest | null;
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

// Payment statuses go beyond the paid/unpaid pair StatusChip knows, so map each to a chip tone here.
const STATUS_TONE: Record<string, 'accent' | 'outline' | 'neutral' | 'danger'> = {
  paid: 'accent',
  unpaid: 'outline',
  refunded: 'neutral',
  failed: 'danger',
};

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
  const [amountError, setAmountError] = useState('');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(''); setMethod('cash'); setStatus('paid'); setDescription(''); setErr(''); setAmountError('');

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
    if (amount.trim() && !(Number(amount) > 0)) return setAmountError('Amount must be more than zero');
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
    <Modal open={open} onClose={onClose} title="Record Payment" locked={loading}>
      {err && <Alert className="mt-3">{err}</Alert>}

      <div className="mt-4 space-y-3">
        <Field label="Booking">
          {(id) => (
            <Select
              id={id}
              value={presetBooking ? presetBooking.id : bookingId}
              onChange={e=>setBookingId(Number(e.target.value))}
              disabled={!!presetBooking}
            >
              {presetBooking ? (
                <option value={presetBooking.id}>
                  #{presetBooking.id} — {presetBooking.guest?.name} — Room {presetBooking.room?.number} (
                  {date(presetBooking.checkIn)} → {date(presetBooking.checkOut)})
                </option>
              ) : (
                <>
                  <option value="">Select unpaid booking…</option>
                  {unpaid.map(b => (
                    <option key={b.id} value={b.id}>
                      #{b.id} — {b.guest?.name} — Room {b.room?.number} (
                      {date(b.checkIn)} → {date(b.checkOut)})
                    </option>
                  ))}
                </>
              )}
            </Select>
          )}
        </Field>

        {selected && (
          <div className="rounded-input bg-slate-tint p-3 text-sm text-ink tabular-nums">
            Nights: <b>{nightsBetween(selected.checkIn, selected.checkOut)}</b> × Rate:{' '}
            <b>{money(selected.room?.price ?? 0)}</b> = <b>{money(computed ?? 0)}</b>
          </div>
        )}

        <Field label="Amount (optional)" error={amountError}>
          {(id) => (
            <>
              <Input
                id={id}
                type="number"
                min={0}
                step="0.01"
                className="font-mono tabular-nums"
                placeholder={selected && computed != null ? `${computed}` : 'e.g. 120'}
                value={amount}
                onChange={e=>{ setAmount(e.target.value); setAmountError(''); }}
              />
              <p className="mt-1 text-xs text-muted">Leave empty to use the calculated total.</p>
            </>
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Method">
            {(id) => (
              <Select id={id} value={method} onChange={e=>setMethod(e.target.value)}>
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={e=>setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Description / Reason (optional)">
          {(id) => (
            <>
              <Textarea
                id={id}
                placeholder="e.g. Paid cash at reception; includes minibar charge"
                value={description}
                onChange={(e)=>setDescription(e.target.value)}
                rows={3}
                maxLength={300}
              />
              <p className="mt-1 text-xs text-muted">Max 300 characters.</p>
            </>
          )}
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={loading}>
          {loading ? 'Saving…' : 'Record'}
        </Button>
      </div>
    </Modal>
  );
}

function PaymentsTab({
  list, q, setQ, openModal, canRecord,
}: {
  list: List<Payment>; q: string; setQ: (v: string)=>void; openModal: ()=>void; canRecord: boolean;
}) {
  const { rows } = list;
  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(p =>
      [
        p.guest?.name,
        p.booking?.room?.number,
        p.method, p.status,
        p.description ?? '',
        String(p.amount),
        date(p.createdAt),
      ].some(v => (v || '').toLowerCase().includes(t)),
    );
  }, [q, rows]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        {typeof window !== 'undefined' && !location.pathname.startsWith('/dashboard') && (
          <Link
            href="/dashboard"
            className={buttonClass('quiet', 'sm')}
          >
            Dashboard
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="sm:w-64" />
          <Button variant="primary" icon={Plus} onClick={openModal} disabled={!canRecord}>Record Payment</Button>
        </div>
      </div>

      <Panel className="overflow-x-auto">
        <ListState list={list}>
          <Table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Description</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id}>
                  <td>{p.booking ? `#${p.booking.id}` : '—'}</td>
                  <td className="font-semibold">{p.guest?.name ?? '—'}</td>
                  <td>{p.booking?.room ? `${p.booking.room.number} — ${p.booking.room.type}` : '—'}</td>
                  <td className="font-mono text-sm whitespace-nowrap tabular-nums">{money(p.amount)}</td>
                  <td>{METHOD_LABEL_MAP.get(p.method) ?? p.method.replace('_', ' ')}</td>
                  <td>
                    <Chip tone={STATUS_TONE[p.status] ?? 'neutral'}><span className="capitalize">{p.status}</span></Chip>
                  </td>
                  <td>
                    {p.description
                      ? <span title={p.description}>
                          {p.description.length > 60 ? p.description.slice(0,60) + '…' : p.description}
                        </span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="font-mono text-sm whitespace-nowrap tabular-nums">{dateTime(p.createdAt)}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td className="text-muted" colSpan={8}>No payments.</td></tr>}
            </tbody>
          </Table>
        </ListState>
      </Panel>
    </>
  );
}

function UnpaidTab({
  list, q, setQ, openForBooking,
}: {
  list: List<Booking>; q: string; setQ: (v: string)=>void; openForBooking: (b: Booking)=>void;
}) {
  const { rows } = list;
  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(b =>
      [
        b.guest?.name,
        b.room?.number,
        b.room?.type,
        date(b.checkIn),
        date(b.checkOut),
      ].some(v => (v || '').toLowerCase().includes(t)),
    );
  }, [q, rows]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Unpaid Bookings</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="sm:w-64" />
        </div>
      </div>

      <Panel className="overflow-x-auto">
        <ListState list={list}>
          <Table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Dates</th>
                <th>Nights × Rate</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b=> {
                const nights = nightsBetween(b.checkIn, b.checkOut);
                const total = nights * (b.room?.price ?? 0);
                return (
                  <tr key={b.id}>
                    <td>#{b.id}</td>
                    <td className="font-semibold">{b.guest?.name}</td>
                    <td><span className="font-mono text-sm font-semibold tabular-nums">{b.room?.number}</span> — {b.room?.type}</td>
                    <td className="font-mono text-sm whitespace-nowrap tabular-nums">
                      {date(b.checkIn)} → {date(b.checkOut)}
                    </td>
                    <td className="font-mono text-sm whitespace-nowrap tabular-nums">{nights} × {money(b.room?.price ?? 0)} = <b>{money(total)}</b></td>
                    <td className="text-right">
                      <Button size="sm" variant="quiet" onClick={()=>openForBooking(b)}>
                        Record
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && <tr><td className="text-muted" colSpan={6}>No unpaid bookings.</td></tr>}
            </tbody>
          </Table>
        </ListState>
      </Panel>
    </>
  );
}

function PaymentsInner() {
  const [tab, setTab] = useState<'payments'|'unpaid'>('payments');

  const payments = useList<Payment>('payments', async () => {
    const res = await axios.get('/payments');
    return Array.isArray(res.data) ? res.data : res.data?.payments ?? [];
  });
  const unpaid = useList<Booking>('unpaid bookings', async () => {
    const res = await axios.get('/bookings', { params: { unpaid: 'true' } });
    return Array.isArray(res.data) ? res.data : res.data?.bookings ?? [];
  });

  const [qPay, setQPay] = useState('');
  const [qUnpaid, setQUnpaid] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [presetBooking, setPresetBooking] = useState<Booking | null>(null);

  const openNewPayment = () => { setPresetBooking(null); setModalOpen(true); };
  const openForBooking = (b: Booking) => { setPresetBooking(b); setModalOpen(true); };

  const onCreated = (p: Payment) => {
    payments.setRows(prev => [p, ...prev]);
    if (p.status === 'paid') unpaid.setRows(prev => prev.filter(b => b.id !== p.booking?.id));
    else unpaid.reload();
  };

  return (
    <Layout>
      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-line pb-4">
        <Button variant={tab==='payments' ? 'primary' : 'text'} size="sm" onClick={()=>setTab('payments')}>
          Payments
        </Button>
        <Button variant={tab==='unpaid' ? 'primary' : 'text'} size="sm" onClick={()=>setTab('unpaid')}>
          Unpaid Bookings
        </Button>
      </div>

      {tab === 'payments' ? (
        <PaymentsTab
          list={payments}
          q={qPay}
          setQ={setQPay}
          openModal={openNewPayment}
          canRecord={payments.state.kind !== 'forbidden' && unpaid.state.kind !== 'forbidden'}
        />
      ) : (
        <UnpaidTab
          list={unpaid}
          q={qUnpaid}
          setQ={setQUnpaid}
          openForBooking={openForBooking}
        />
      )}

      <RecordPaymentModal
        open={modalOpen}
        onClose={()=>setModalOpen(false)}
        onCreated={onCreated}
        presetBooking={presetBooking}
      />
    </Layout>
  );
}

export default function PaymentsPage() {
  return (
    <RequireAuth>
      <PaymentsInner />
    </RequireAuth>
  );
}
