import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import { useList } from '@/lib/useList';

type Guest = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
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

/* -------------------- Guests Page -------------------- */
function GuestsInner() {
  const guestList = useList<Guest>('guests', async () => {
    const res = await axios.get('/guests');
    return Array.isArray(res.data) ? res.data : res.data?.guests ?? [];
  });
  const { rows: guests, setRows: setGuests } = guestList;
  const [q, setQ] = useState('');

  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((g) => [g.name, g.phone ?? '', g.email ?? ''].some((v) => (v || '').toLowerCase().includes(term)));
  }, [q, guests]);

  const onCreated = (g: Guest) => setGuests((p) => [g, ...p]);

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Guests</h1>
        <div className="ml-auto flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests…" className="w-64 rounded-md border px-3 py-2" />
          <button onClick={() => setAddOpen(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-white">Add Guest</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <ListState list={guestList} empty="No guests found.">
          {filtered.length === 0 ? (
            <div className="p-6 text-gray-600">No guests found.</div>
          ) : (
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
          )}
        </ListState>
      </div>

      <AddGuestModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={onCreated} />
    </Layout>
  );
}

export default function GuestsPage() {
  return (
    <RequireAuth>
      <GuestsInner />
    </RequireAuth>
  );
}
