import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import { useToast } from '@/components/Toast';
import { useList } from '@/lib/useList';

type Guest = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
};

type Editing = { mode: 'add' } | { mode: 'edit'; guest: Guest };

type FieldErrors = { name?: string; phone?: string };

function validate(name: string, phone: string): FieldErrors {
  const phoneLength = phone.trim().length;
  return {
    name: name.trim() ? undefined : 'Name is required',
    phone: phoneLength === 0 ? 'Phone is required' : phoneLength < 3 ? 'Phone must be 3 to 30 characters' : undefined,
  };
}

function saveErrorMessage(e: unknown): string {
  if (!isAxiosError(e) || !e.response || e.response.status >= 500) return "Couldn't save guest";
  const message = e.response.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : "Couldn't save guest";
}

function GuestModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: (g: Guest) => void;
}) {
  const { push } = useToast();
  const initial = editing.mode === 'edit' ? editing.guest : undefined;
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const found = validate(name, phone);
    setErrors(found);
    if (found.name || found.phone) return;
    const body = { name: name.trim(), phone: phone.trim(), email: email.trim() || null };
    try {
      setSaving(true);
      const res = editing.mode === 'edit'
        ? await axios.patch(`/guests/${editing.guest.id}`, body)
        : await axios.post('/guests', body);
      onSaved(res.data);
    } catch (e) {
      push(saveErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{editing.mode === 'edit' ? 'Edit Guest' : 'Add Guest'}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {editing.mode === 'edit' ? "Update this guest's details" : 'Create a new guest profile'}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
            <input className="w-full rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input required maxLength={30} className="w-full rounded-md border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input className="w-full rounded-md border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
            {saving ? 'Saving…' : editing.mode === 'edit' ? 'Save changes' : 'Add Guest'}
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

  const [editing, setEditing] = useState<Editing | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((g) => [g.name, g.phone ?? '', g.email ?? ''].some((v) => (v || '').toLowerCase().includes(term)));
  }, [q, guests]);

  const onSaved = (saved: Guest) => {
    setGuests((rows) => (rows.some((g) => g.id === saved.id) ? rows.map((g) => (g.id === saved.id ? saved : g)) : [saved, ...rows]));
    setEditing(null);
  };

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Guests</h1>
        <div className="ml-auto flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests…" className="w-64 rounded-md border px-3 py-2" />
          <button onClick={() => setEditing({ mode: 'add' })} className="rounded-md bg-indigo-600 px-4 py-2 text-white">Add Guest</button>
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
                      <button onClick={() => setEditing({ mode: 'edit', guest: g })} className="rounded border px-3 py-1 text-xs font-semibold text-gray-700">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </ListState>
      </div>

      {editing && <GuestModal editing={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
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
