import { useEffect, useState } from 'react';

export type GuestInput = { name: string; phone: string; email?: string };

export default function GuestForm({
  initial, onSubmit, submitting,
}: {
  initial?: GuestInput;
  onSubmit: (data: GuestInput)=>void;
  submitting?: boolean;
}) {
  const [name, setName]   = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');

  useEffect(() => {
    if (initial) { setName(initial.name); setPhone(initial.phone); setEmail(initial.email ?? ''); }
  }, [initial]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ name, phone, email: email || undefined }); }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1 block text-sm text-gray-600">Name</label>
        <input required value={name} onChange={(e)=>setName(e.target.value)}
               className="w-full rounded-md border px-3 py-2" placeholder="Full name" />
      </div>
      <div>
        <label className="mb-1 block text-sm text-gray-600">Phone</label>
        <input required value={phone} onChange={(e)=>setPhone(e.target.value)}
               className="w-full rounded-md border px-3 py-2" placeholder="+251..." />
      </div>
      <div>
        <label className="mb-1 block text-sm text-gray-600">Email (optional)</label>
        <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}
               className="w-full rounded-md border px-3 py-2" placeholder="name@example.com" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={!!submitting}
                className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
