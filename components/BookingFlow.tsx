import { FormEvent, useReducer } from 'react';
import { isAxiosError } from 'axios';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import ListState from '@/components/ListState';
import { useToast } from '@/components/Toast';
import { useList } from '@/lib/useList';
import axios from '@/utils/axiosInstance';
import {
  STEPS, addDays, dateErrors, flowReducer, initialFlow, nights, planSubmit, todayYMD,
  type FlowStep, type GuestDraft,
} from '@/lib/bookingFlow';

type Guest = { id: number; name: string; phone: string; email?: string | null };
type Room = { id: number; number: string; type: string; price: number };

const STEP_LABEL: Record<FlowStep, string> = { guest: 'Guest', stay: 'Dates and room', review: 'Review' };

const INPUT = 'w-full rounded border px-3 py-2';

function apiMessage(e: unknown, fallback: string): string {
  const message = isAxiosError(e) ? e.response?.data?.message : undefined;
  if (Array.isArray(message)) return message.join('. ');
  return typeof message === 'string' ? message : fallback;
}

function Flow<B>({ onClose, onCreated }: { onClose: () => void; onCreated: (booking: B) => void }) {
  const [state, dispatch] = useReducer(flowReducer, initialFlow);
  const { push } = useToast();
  const today = todayYMD();
  const { step, guest, stay, errors, submit } = state;

  const guests = useList<Guest>('guests', async () => {
    const res = await axios.get('/guests');
    return Array.isArray(res.data) ? res.data : res.data.guests ?? [];
  });

  const datesReady = !!stay.checkIn && !!stay.checkOut && Object.keys(dateErrors(stay, today)).length === 0;
  const rooms = useList<Room>('available rooms', async () => {
    if (!datesReady) return [];
    const res = await axios.get('/rooms/available', { params: { checkIn: stay.checkIn, checkOut: stay.checkOut } });
    return Array.isArray(res.data) ? res.data : res.data.rooms ?? [];
  }, datesReady ? `${stay.checkIn}|${stay.checkOut}` : '');

  const pickedGuest = guest.kind === 'existing' ? guests.rows.find((g) => g.id === guest.guestId) : guest.draft;
  const pickedRoom = rooms.rows.find((r) => r.id === stay.roomId);

  async function create() {
    if (submit.kind === 'saving') return;
    const plan = planSubmit(state, todayYMD());
    if (plan.kind === 'invalid') {
      dispatch({ type: 'submitRejected', step: plan.step, errors: plan.errors });
      return;
    }
    dispatch({ type: 'submitStarted' });
    try {
      let guestId: number;
      if (plan.guest.kind === 'existing') {
        guestId = plan.guest.guestId;
      } else {
        const res = await axios.request({ method: plan.guest.method, url: plan.guest.path, data: plan.guest.body });
        guestId = res.data.id;
        dispatch({ type: 'guestSaved', guestId });
      }
      const res = await axios.post('/bookings', plan.booking(guestId));
      push('Booking created successfully', 'success');
      onCreated(res.data);
      onClose();
    } catch (e) {
      dispatch({ type: 'submitFailed', message: apiMessage(e, 'Failed to create booking') });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === 'review') create();
    else dispatch({ type: 'next', today: todayYMD() });
  }

  const draftField = (field: keyof GuestDraft, label: string, props: { type?: string; placeholder?: string }) => (
    guest.kind === 'new' && (
      <Field label={label} error={errors[field]}>
        {(id) => (
          <input
            id={id}
            className={INPUT}
            value={guest.draft[field]}
            onChange={(e) => dispatch({ type: 'editDraft', field, value: e.target.value })}
            aria-invalid={!!errors[field]}
            {...props}
          />
        )}
      </Field>
    )
  );

  return (
    <Modal open onClose={onClose} title="Create Booking" size="2xl" locked={submit.kind === 'saving'}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={s === step ? 'step' : undefined}
              className={s === step ? 'font-semibold text-indigo-700' : 'text-gray-500'}
            >
              {i + 1}. {STEP_LABEL[s]}
            </li>
          ))}
        </ol>

        {submit.kind === 'failed' && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submit.message}</div>
        )}

        {step === 'guest' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['existing', 'new'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={guest.kind === kind}
                  onClick={() => dispatch({ type: 'chooseGuestKind', kind })}
                  className={`rounded px-3 py-1.5 text-sm ${guest.kind === kind ? 'bg-indigo-600 text-white' : 'border hover:bg-gray-50'}`}
                >
                  {kind === 'existing' ? 'Existing guest' : 'New guest'}
                </button>
              ))}
            </div>

            {guest.kind === 'existing' ? (
              <ListState list={guests} empty="No guests yet. Choose New guest.">
                <Field label="Guest" error={errors.guestId}>
                  {(id) => (
                    <select
                      id={id}
                      className={INPUT}
                      value={guest.guestId ?? ''}
                      onChange={(e) => dispatch({ type: 'pickGuest', guestId: e.target.value ? Number(e.target.value) : null })}
                      aria-invalid={!!errors.guestId}
                    >
                      <option value="">Select guest…</option>
                      {guests.rows.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.phone}</option>)}
                    </select>
                  )}
                </Field>
              </ListState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {draftField('name', 'Full name', { placeholder: 'Full name' })}
                {draftField('phone', 'Phone', { type: 'tel', placeholder: '+251…' })}
                <div className="sm:col-span-2">{draftField('email', 'Email (optional)', { type: 'email', placeholder: 'name@example.com' })}</div>
              </div>
            )}
          </div>
        )}

        {step === 'stay' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Check-in" error={errors.checkIn}>
              {(id) => (
                <input
                  id={id}
                  type="date"
                  className={INPUT}
                  min={today}
                  value={stay.checkIn}
                  onChange={(e) => dispatch({ type: 'editDate', field: 'checkIn', value: e.target.value, today })}
                  aria-invalid={!!errors.checkIn}
                />
              )}
            </Field>
            <Field label="Check-out" error={errors.checkOut}>
              {(id) => (
                <input
                  id={id}
                  type="date"
                  className={INPUT}
                  min={addDays(stay.checkIn && stay.checkIn > today ? stay.checkIn : today, 1)}
                  value={stay.checkOut}
                  onChange={(e) => dispatch({ type: 'editDate', field: 'checkOut', value: e.target.value, today })}
                  aria-invalid={!!errors.checkOut}
                />
              )}
            </Field>
            <Field label="Room" error={errors.roomId} className="sm:col-span-2">
              {(id) => (
                <select
                  id={id}
                  className={INPUT}
                  value={stay.roomId ?? ''}
                  onChange={(e) => dispatch({ type: 'pickRoom', roomId: e.target.value ? Number(e.target.value) : null })}
                  disabled={!datesReady || rooms.state.kind !== 'ready' || rooms.state.updating || rooms.rows.length === 0}
                  aria-invalid={!!errors.roomId}
                >
                  <option value="">
                    {!datesReady ? 'Pick valid dates first'
                      : rooms.state.kind === 'loading' || (rooms.state.kind === 'ready' && rooms.state.updating) ? 'Loading rooms…'
                      : rooms.state.kind !== 'ready' ? "Couldn't load rooms"
                      : rooms.rows.length === 0 ? 'No rooms free for these dates'
                      : 'Select room…'}
                  </option>
                  {rooms.rows.map((r) => (
                    <option key={r.id} value={r.id}>{r.number} — {r.type} — ${Number(r.price).toFixed(2)}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}

        {step === 'review' && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-gray-500">Guest</dt>
            <dd>{pickedGuest?.name} — {pickedGuest?.phone}{guest.kind === 'new' && ' (new)'}</dd>
            <dt className="text-gray-500">Stay</dt>
            <dd>{stay.checkIn} → {stay.checkOut} ({nights(stay)} {nights(stay) === 1 ? 'night' : 'nights'})</dd>
            <dt className="text-gray-500">Room</dt>
            <dd>{pickedRoom?.number} — {pickedRoom?.type}</dd>
          </dl>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submit.kind === 'saving'} className="mr-auto rounded border px-4 py-2 disabled:opacity-60">Cancel</button>
          {step !== 'guest' && (
            <button type="button" onClick={() => dispatch({ type: 'back' })} disabled={submit.kind === 'saving'} className="rounded border px-4 py-2 disabled:opacity-60">
              Back
            </button>
          )}
          {step === 'review' ? (
            <button type="submit" disabled={submit.kind === 'saving'} className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
              {submit.kind === 'saving' ? 'Creating…' : 'Create booking'}
            </button>
          ) : (
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white">Next</button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default function BookingFlow<B>({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (booking: B) => void;
}) {
  return open && <Flow onClose={onClose} onCreated={onCreated} />;
}
