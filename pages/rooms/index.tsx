/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';

type Room = { id: number; number: string; type: string; price: number };

function AddRoomModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (r: Room) => void;
}) {
  const [number, setNumber] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState<string>('');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => { if (open) { setNumber(''); setType(''); setPrice(''); setErr(''); } }, [open]);
  if (!open) return null;

  const submit = async () => {
    setErr('');
    if (!number.trim()) return setErr('Room number is required');
    if (!type.trim()) return setErr('Type is required');
    const p = parseFloat(price); if (isNaN(p) || p <= 0) return setErr('Price must be a positive number');
    try {
      setLoading(true);
      const res = await axios.post('/rooms', { number: number.trim(), type: type.trim(), price: p });
      onCreated(res.data); onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to add room');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Add Room</h3>
        {err && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="mt-4 space-y-3">
          <input className="w-full rounded border px-3 py-2" placeholder="Number" value={number} onChange={e=>setNumber(e.target.value)} />
          <input className="w-full rounded border px-3 py-2" placeholder="Type (Single/Double/Suite…)" value={type} onChange={e=>setType(e.target.value)} />
          <input className="w-full rounded border px-3 py-2" placeholder="Price (e.g. 75)" value={price} onChange={e=>setPrice(e.target.value)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {loading ? 'Saving…' : 'Add Room'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomsInner() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [q, setQ] = useState(''); const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const fetchRooms = async () => {
    try { const res = await axios.get('/rooms'); setRooms(Array.isArray(res.data) ? res.data : res.data?.rooms ?? []); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchRooms(); }, []);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rooms.filter(r => [r.number, r.type, String(r.price)].some(v => (v||'').toLowerCase().includes(t)));
  }, [q, rooms]);

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <div className="ml-auto flex gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="w-64 rounded border px-3 py-2" />
          <button onClick={()=>setModal(true)} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white">Add Room</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded bg-white shadow">
        {loading ? <div className="p-6 text-gray-600">Loading…</div> : (
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.number}</td>
                  <td className="px-4 py-3">{r.type}</td>
                  <td className="px-4 py-3">${r.price.toFixed(2)}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td className="px-4 py-6 text-gray-500" colSpan={3}>No rooms.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <AddRoomModal open={modal} onClose={()=>setModal(false)} onCreated={(r)=>setRooms(prev=>[r,...prev])}/>
    </Layout>
  );
}

export default function RoomsPage() {
  return (
    <RequireAuth roles={['admin','reception','manager']}>
      <RoomsInner/>
    </RequireAuth>
  );
}
