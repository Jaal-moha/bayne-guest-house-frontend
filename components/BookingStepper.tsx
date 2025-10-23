import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import GuestForm, { GuestInput } from '@/components/forms/GuestForm';
import axios from '@/utils/axiosInstance';
import { useToast } from './Toast';

type Step = 0 | 1 | 2;

export default function BookingStepper({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated?: (b: any) => void;
}) {
    const [step, setStep] = useState<Step>(0);

    // guest step
    const [guest, setGuest] = useState<GuestInput | null>(null);
    const [guestSubmitting, setGuestSubmitting] = useState(false);
    const [guestId, setGuestId] = useState<number | null>(null);

    // existing guests list / search
    const [guests, setGuests] = useState<any[]>([]);
    const [guestMode, setGuestMode] = useState<'new' | 'existing'>('new');
    const [guestSearch, setGuestSearch] = useState('');

    // booking step
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [rooms, setRooms] = useState<any[]>([]);
    const [roomId, setRoomId] = useState<number | ''>('');

    const [err, setErr] = useState('');
    const [loadingCreate, setLoadingCreate] = useState(false);

    const { push } = useToast();

    useEffect(() => { if (!open) { reset(); } }, [open]);

    function reset() {
        setStep(0); setGuest(null); setGuestId(null); setGuestSubmitting(false);
        setCheckIn(''); setCheckOut(''); setRooms([]); setRoomId(''); setErr(''); setLoadingCreate(false);
        setGuests([]); setGuestMode('new'); setGuestSearch('');
    }

    // create guest (if not existing)
    const handleGuestSave = async (data: GuestInput) => {
        setErr('');
        setGuestSubmitting(true);
        try {
            // create guest
            const res = await axios.post('/guests', data);
            const created = res.data;
            setGuest(created);
            setGuestId(created.id ?? created?.guest?.id ?? null);
            setStep(1);
        } catch (e: any) {
            setErr(e?.response?.data?.message || e?.message || 'Failed to save guest');
        } finally { setGuestSubmitting(false); }
    };

    // fetch guests when modal opens (for existing selection)
    useEffect(() => {
        if (!open) return;
        const fetch = async () => {
            try {
                const res = await axios.get('/guests');
                const list = Array.isArray(res.data) ? res.data : res.data.guests ?? [];
                setGuests(list);
            } catch (e: any) {
                // ignore silently; we only use guests for convenience
            }
        };
        fetch();
    }, [open]);

    // fetch available rooms when dates set
    useEffect(() => {
        const fetchRooms = async () => {
            setRooms([]);
            if (!checkIn || !checkOut) return;
            try {
                const res = await axios.get('/rooms/available', { params: { checkIn, checkOut } });
                const list = Array.isArray(res.data) ? res.data : res.data.rooms ?? res.data;
                setRooms(list);
            } catch (e: any) {
                setErr(e?.response?.data?.message || 'Failed to load available rooms');
            }
        };
        fetchRooms();
    }, [checkIn, checkOut]);

    const createBooking = async () => {
        setErr('');
        if (!guestId) return setErr('Guest missing');
        if (!checkIn || !checkOut) return setErr('Select dates');
        if (!roomId) return setErr('Select a room');

        try {
            setLoadingCreate(true);
            const res = await axios.post('/bookings', {
                guestId, roomId, checkIn: new Date(checkIn), checkOut: new Date(checkOut),
            });
            onCreated?.(res.data);
            // show success toast
            try { push('Booking created successfully', 'success'); } catch (e) { /* noop */ }
            onClose();
            reset();
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to create booking';
            setErr(msg);
            try { push(msg, 'error'); } catch (er) { /* noop */ }
        } finally { setLoadingCreate(false); }
    };

    const filteredGuests = useMemo(() => {
        const t = guestSearch.toLowerCase();
        if (!t) return guests;
        return guests.filter(g => (g.name || '').toLowerCase().includes(t) || (g.phone || '').toLowerCase().includes(t) || (g.email || '').toLowerCase().includes(t));
    }, [guestSearch, guests]);

    return (
        <Modal open={open} onClose={onClose} title={step === 0 ? 'Guest' : step === 1 ? 'Booking details' : 'Review & Create'}>
            <div className="space-y-4">
                {err && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

                {step === 0 && (
                    <div>
                        <div className="mb-3 text-sm text-gray-600">Choose an existing guest or create a new one.</div>

                        <div className="mb-3 flex gap-2">
                            <button onClick={() => setGuestMode('existing')} className={`rounded px-3 py-1 ${guestMode === 'existing' ? 'bg-indigo-600 text-white' : 'border'}`}>Existing guest</button>
                            <button onClick={() => setGuestMode('new')} className={`rounded px-3 py-1 ${guestMode === 'new' ? 'bg-indigo-600 text-white' : 'border'}`}>New guest</button>
                        </div>

                        {guestMode === 'existing' ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-sm text-gray-600">Search guests</label>
                                    <input value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} placeholder="Search by name, phone or email" className="w-full rounded border px-3 py-2" />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm text-gray-600">Select guest</label>
                                    <select className="w-full rounded border px-3 py-2" value={guestId ?? ''} onChange={(e) => {
                                        const id = e.target.value ? Number(e.target.value) : null;
                                        setGuestId(id);
                                        const sel = guests.find(g => g.id === id) ?? null;
                                        if (sel) setGuest({ name: sel.name, phone: sel.phone, email: sel.email ?? undefined });
                                    }}>
                                        <option value="">Select guest…</option>
                                        {filteredGuests.map(g => <option key={g.id} value={g.id}>{g.name} — {g.phone}</option>)}
                                    </select>
                                </div>

                                <div className="flex justify-end">
                                    <button disabled={!guestId} onClick={() => { if (guestId) setStep(1); }} className="rounded bg-indigo-600 px-4 py-2 text-white">Use guest</button>
                                </div>
                            </div>
                        ) : (
                            <GuestForm initial={guest ?? undefined} onSubmit={handleGuestSave} submitting={guestSubmitting} />
                        )}
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-sm text-gray-600">Check-in</label>
                            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full rounded border px-3 py-2" />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-gray-600">Check-out</label>
                            <input type="date" value={checkOut} min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)} className="w-full rounded border px-3 py-2" />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm text-gray-600">Available rooms</label>
                            <select className="w-full rounded border px-3 py-2" value={roomId} onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : '')}>
                                <option value="">Select room…</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.number} — {r.type} — ${Number(r.price).toFixed(2)}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Guest</h4>
                        <div className="text-sm text-gray-700">{guest?.name} — {guest?.phone} {guest?.email ? `— ${guest.email}` : ''}</div>

                        <h4 className="mt-3 text-sm font-medium">Booking</h4>
                        <div className="text-sm text-gray-700">{checkIn} → {checkOut}</div>
                        <div className="text-sm text-gray-700">Room: {rooms.find(r => r.id === roomId)?.number ?? '—'}</div>
                    </div>
                )}

                <div className="flex justify-between pt-3">
                    <div>
                        {step > 0 && <button onClick={() => setStep(s => (s - 1) as Step)} className="rounded border px-3 py-1">Back</button>}
                    </div>
                    <div className="flex gap-2">
                        {step < 2 && <button onClick={() => setStep(s => (s + 1) as Step)} className="rounded bg-indigo-600 px-4 py-2 text-white">Next</button>}
                        {step === 2 && <button onClick={createBooking} disabled={loadingCreate} className="rounded bg-emerald-600 px-4 py-2 text-white">{loadingCreate ? 'Creating…' : 'Create Booking'}</button>}
                        {step === 1 && <button onClick={() => setStep(2)} className="rounded bg-indigo-600 px-4 py-2 text-white">Review</button>}
                        <button onClick={onClose} className="rounded border px-3 py-1">Cancel</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
