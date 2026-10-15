import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import Button from '@/components/Button';
import { Input } from '@/components/Input';
import Panel from '@/components/Panel';
import Table from '@/components/Table';
import { Plus } from '@phosphor-icons/react';
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
    <Modal open onClose={onClose} locked={saving} title={editing.mode === 'edit' ? 'Edit Guest' : 'Add Guest'} size="md">
      <p className="text-sm text-muted">
        {editing.mode === 'edit' ? "Update this guest's details" : 'Create a new guest profile'}
      </p>

      <div className="mt-4 space-y-3">
        <Field label="Full name" error={errors.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Phone" error={errors.phone}>
          {(id) => <Input id={id} required maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="Email">
          {(id) => <Input id={id} value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : editing.mode === 'edit' ? 'Save changes' : 'Add Guest'}
        </Button>
      </div>
    </Modal>
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Guests</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests…" className="sm:w-64" />
          <Button variant="primary" icon={Plus} onClick={() => setEditing({ mode: 'add' })}>Add Guest</Button>
        </div>
      </div>

      <Panel className="overflow-x-auto">
        <ListState list={guestList} empty="No guests found.">
          {filtered.length === 0 ? (
            <div className="p-6 text-muted">No guests found.</div>
          ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td className="font-semibold">{g.name}</td>
                  <td>{g.phone || <span className="text-muted">—</span>}</td>
                  <td>{g.email || <span className="text-muted">—</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setEditing({ mode: 'edit', guest: g })}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          )}
        </ListState>
      </Panel>

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
