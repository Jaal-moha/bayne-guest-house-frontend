/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import { Input } from '@/components/Input';
import Panel from '@/components/Panel';
import Table from '@/components/Table';
import { Plus } from '@phosphor-icons/react';
import { useList } from '@/lib/useList';
import { money } from '@/lib/format';

type Room = { id: number; number: string; type: string; price: number; };

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
    <Modal open={open} onClose={onClose} title="Add Room" size="md" locked={loading}>
      {err && <Alert className="mt-3">{err}</Alert>}
      <div className="mt-4 space-y-3">
        <Field label="Number">
          {(id) => <Input id={id} placeholder="Number" value={number} onChange={e => setNumber(e.target.value)} />}
        </Field>
        <Field label="Type">
          {(id) => <Input id={id} placeholder="Type (Single/Double/Suite…)" value={type} onChange={e => setType(e.target.value)} />}
        </Field>
        <Field label="Price">
          {(id) => <Input id={id} className="font-mono tabular-nums" placeholder="Price (e.g. 75)" value={price} onChange={e => setPrice(e.target.value)} />}
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={loading}>
          {loading ? 'Saving…' : 'Add Room'}
        </Button>
      </div>
    </Modal>
  );
}

function EditRoomModal({ open, onClose, room, onUpdated }: {
  open: boolean;
  onClose: () => void;
  room?: Room | null;
  onUpdated: (r: Room) => void;
}) {
  const [number, setNumber] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState<string>('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && room) {
      setNumber(room.number ?? '');
      setType(room.type ?? '');
      setPrice(String(room.price ?? ''));
      setErr('');
    } else if (open) {
      setNumber(''); setType(''); setPrice(''); setErr('');
    }
  }, [open, room]);

  if (!open || !room) return null;

  const submit = async () => {
    setErr('');
    if (!number.trim()) return setErr('Room number is required');
    if (!type.trim()) return setErr('Type is required');
    const p = parseFloat(price); if (isNaN(p) || p <= 0) return setErr('Price must be a positive number');
    try {
      setLoading(true);
      const res = await axios.patch(`/rooms/${room.id}`, { number: number.trim(), type: type.trim(), price: p });
      const updated = (res.data && (res.data.room ?? res.data)) as Room;
      onUpdated(updated);
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to update room');
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Room" size="md" locked={loading}>
      {err && <Alert className="mt-3">{err}</Alert>}
      <div className="mt-4 space-y-3">
        <Field label="Number">
          {(id) => <Input id={id} placeholder="Number" value={number} onChange={e => setNumber(e.target.value)} />}
        </Field>
        <Field label="Type">
          {(id) => <Input id={id} placeholder="Type (Single/Double/Suite…)" value={type} onChange={e => setType(e.target.value)} />}
        </Field>
        <Field label="Price">
          {(id) => <Input id={id} className="font-mono tabular-nums" placeholder="Price (e.g. 75)" value={price} onChange={e => setPrice(e.target.value)} />}
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

function RoomsInner() {
  const roomList = useList<Room>('rooms', async () => {
    const res = await axios.get('/rooms');
    return Array.isArray(res.data) ? res.data : res.data?.rooms ?? [];
  });
  const { rows: rooms, setRows: setRooms } = roomList;
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rooms.filter(r => [r.number, r.type, String(r.price)].some(v => (v || '').toLowerCase().includes(t)));
  }, [q, rooms]);

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="sm:w-64" />
          <Button variant="primary" icon={Plus} onClick={() => setModal(true)}>Add Room</Button>
        </div>
      </div>

      <Panel className="overflow-x-auto">
        <ListState list={roomList}>
          <Table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="font-mono text-sm font-semibold tabular-nums">{r.number}</td>
                  <td>{r.type}</td>
                  <td className="font-mono text-sm tabular-nums">{money(r.price)}</td>
                  <td>
                    <Button size="sm" onClick={() => { setEditing(r); setEditOpen(true); }}>Edit</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="text-muted" colSpan={4}>No rooms.</td></tr>}
            </tbody>
          </Table>
        </ListState>
      </Panel>

      <AddRoomModal open={modal} onClose={() => setModal(false)} onCreated={(r) => setRooms(prev => [r, ...prev])} />
      <EditRoomModal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditing(null); }}
        room={editing}
        onUpdated={(u) => setRooms(prev => prev.map(p => p.id === u.id ? u : p))}
      />
    </Layout>
  );
}

export default function RoomsPage() {
  return (
    <RequireAuth>
      <RoomsInner />
    </RequireAuth>
  );
}
