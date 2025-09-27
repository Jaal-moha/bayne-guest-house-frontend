/* eslint-disable @typescript-eslint/no-explicit-any */
// pages/staff/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';

type UserLite = {
  id: number;
  email: string;
  role: string;
  staffId: number;
  name?: string;
};

type Staff = {
  id: number;
  name: string;
  role: string;
  phone: string;
  emergencyContact?: string | null;
  barcode: string;
  user?: UserLite | null;
  idCardUrl?: string;
};

const ROLE_VALUES = [
  'admin','manager','reception','housekeeping','barista','security','finance','store',
] as const;

/* -------------------- Add Staff Modal -------------------- */
function genPassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let p = '';
  for (let i = 0; i < length; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

function AddStaffModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (s: Staff) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; id?: number } | null>(null);

  // New: two-step flow + toggle to create account
  const [createAccount, setCreateAccount] = useState(true);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setRole('');
      setPhone('');
      setEmergencyContact('');
      setErr('');
      setCreatedCreds(null);
      setCreateAccount(true);
      setStep(1);
      setEmail('');
      setPassword('');
    }
  }, [open]);

  if (!open) return null;

  // Step 1: validate fields and generate password (if needed) then move to step 2
  const proceedToReview = () => {
    setErr('');
    if (!name.trim()) return setErr('Name is required');
    if (!role) return setErr('Role is required');
    if (!phone.trim()) return setErr('Phone is required');
    if (createAccount && !email.trim()) return setErr('Email is required for account creation');

    if (createAccount) {
      setPassword(genPassword());
    }
    setStep(2);
  };

  // Final submit: create staff first, then user account if needed
  const submit = async () => {
    setErr('');
    try {
      setLoading(true);
      // Step 1: Create staff (no user fields)
      const staffPayload = {
        name: name.trim(),
        role,
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim() || undefined,
      };
      const staffRes = await axios.post('/staff', staffPayload);
      const newStaff = staffRes.data;
      onCreated(newStaff);

      if (createAccount) {
        // Step 2: Create user account for the new staff
        const userPayload = {
          email: email.trim(),
          password,
          role, // Use the staff's role as default
        };
        await axios.post(`/users/staff/${newStaff.id}`, userPayload);
        setCreatedCreds({ email: email.trim(), password, id: newStaff.id });
      } else {
        // No account created, close modal
        setCreatedCreds(null);
        onClose();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to add staff';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{step === 1 ? 'Add Staff' : 'Review & Create'}</h3>
        <p className="mt-1 text-sm text-gray-500">{step === 1 ? 'Enter staff details' : 'Confirm details and create staff'}</p>

        {err && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        {!createdCreds ? (
          <>
            {step === 1 ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sara Reception"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                  <select
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="" disabled>Select a role…</option>
                    {ROLE_VALUES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251 9xx xxx xxx"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Emergency contact (optional)</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Name / Phone"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    id="create-account"
                    type="checkbox"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="create-account" className="text-sm text-gray-700">
                    Create user account for this staff (recommended)
                  </label>
                </div>

                {createAccount && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                    <input
                      className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. sara@example.com"
                      type="email"
                    />
                  </div>
                )}
              </div>
            ) : (
              // Step 2: review details
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-sm text-gray-700"><strong>Name:</strong> {name}</div>
                  <div className="text-sm text-gray-700"><strong>Role:</strong> {role}</div>
                  <div className="text-sm text-gray-700"><strong>Phone:</strong> {phone}</div>
                </div>

                {createAccount ? (
                  <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                    <div className="text-sm text-gray-700"><strong>Email:</strong> {email}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-500">Generated password</div>
                        <div className="font-mono">{password}</div>
                      </div>
                      <div>
                        <button
                          onClick={() => setPassword(genPassword())}
                          className="ml-2 rounded border px-2 py-1 text-xs"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      The staff will use this email and password to sign in. They will be required to change the password on first login.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-yellow-100 bg-yellow-50 p-3 text-sm text-yellow-800">
                    No user account will be created. You can create one later from the staff details.
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  if (step === 2) {
                    setStep(1);
                    setErr('');
                    return;
                  }
                  onClose();
                }}
                className="rounded-md border px-4 py-2 hover:bg-gray-50"
                disabled={loading}
              >
                {step === 2 ? 'Back' : 'Cancel'}
              </button>

              {step === 1 ? (
                <button
                  onClick={proceedToReview}
                  className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={loading}
                  className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? 'Saving…' : createAccount ? 'Create Staff & Account' : 'Create Staff'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-md border border-green-100 bg-green-50 p-4 text-sm text-green-800">
            <div>Staff created{createdCreds.id ? ` (ID: ${createdCreds.id})` : ''}.</div>
            <div className="mt-2">
              <strong>Email:</strong> <code className="ml-1">{createdCreds.email}</code>
            </div>
            <div className="mt-1">
              <strong>Password:</strong> <code className="ml-1">{createdCreds.password}</code>
            </div>
            <div className="mt-2 text-xs text-gray-700">Credentials must be delivered to the staff member. They will be required to change the password on first login.</div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCreatedCreds(null);
                  onClose();
                }}
                className="rounded-md border px-4 py-2 hover:bg-gray-50"
              >
                Done
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`);
                }}
                className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
              >
                Copy Credentials
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Edit Staff Modal -------------------- */
function EditStaffModal({
  open,
  staff,
  onClose,
  onUpdated,
}: {
  open: boolean;
  staff?: Staff | null;
  onClose: () => void;
  onUpdated: (s: Staff) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && staff) {
      setName(staff.name ?? '');
      setRole(staff.role ?? '');
      setPhone(staff.phone ?? '');
      setEmergencyContact(staff.emergencyContact ?? '');
      setErr('');
    } else if (open) {
      setName('');
      setRole('');
      setPhone('');
      setEmergencyContact('');
      setErr('');
    }
  }, [open, staff]);

  if (!open) return null;

  const submit = async () => {
    setErr('');
    if (!staff) return setErr('No staff selected');
    if (!name.trim()) return setErr('Name is required');
    if (!role) return setErr('Role is required');
    if (!phone.trim()) return setErr('Phone is required');

    try {
      setLoading(true);
      const res = await axios.put(`/staff/${staff.id}`, {
        name: name.trim(),
        role,
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim() || undefined,
      });
      onUpdated(res.data);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update staff';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Edit Staff</h3>
        <p className="mt-1 text-sm text-gray-500">Update staff member details</p>

        {err && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
            <input
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sara Reception"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
            <select
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="" disabled>Select a role…</option>
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9xx xxx xxx"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Emergency contact (optional)</label>
            <input
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Name / Phone"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-4 py-2 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Delete Confirmation Modal -------------------- */
function DeleteConfirmationModal({
  open,
  staffName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  staffName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Confirm Deletion</h3>
        <p className="mt-1 text-sm text-gray-500">
          Are you sure you want to delete <strong>{staffName}</strong> and their account? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Staff Table -------------------- */
function StaffTable({
  staff,
  onPreview,
  onEdit,
  onDelete,
}: {
  staff: Staff[];
  onPreview?: (s: Staff) => void;
  onEdit?: (s: Staff) => void;
  onDelete?: (s: Staff) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow">
      <table className="min-w-full border-collapse table-auto">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Emergency</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Barcode</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Account</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-3">{s.name}</td>
              <td className="px-4 py-3">{s.role}</td>
              <td className="px-4 py-3">{s.phone}</td>
              <td className="px-4 py-3">{s.emergencyContact || <span className="text-gray-400">—</span>}</td>
              <td className="px-4 py-3 font-mono text-sm">{s.barcode}</td>
              <td className="px-4 py-3">
                {s.user ? (
                  <span className="rounded bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                    {s.user.email}
                  </span>
                ) : (
                  <span className="text-gray-400">No account</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {s.id ? (
                    <>
                      <button
                        onClick={() => onPreview?.(s)}
                        className="inline-block rounded bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Preview / Download
                      </button>
                      <button
                        onClick={() => onEdit?.(s)}
                        className="inline-block rounded border px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete?.(s)}
                        className="inline-block rounded bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------- PDF Preview Modal -------------------- */
function PdfPreviewModal({
  open,
  loading,
  url,
  filename,
  onClose,
  error,
  onPrint,
}: {
  open: boolean;
  loading: boolean;
  url?: string;
  filename?: string;
  error?: string;
  onClose: () => void;
  onPrint?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">ID Card Preview</h3>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                download={filename}
                className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Download
              </a>
            )}
            {onPrint && !loading && (
              <button
                onClick={onPrint}
                className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
              >
                Print
              </button>
            )}
            <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Close</button>
          </div>
        </div>

        <div className="mt-3 h-[70vh]">
          {loading ? (
            <div className="grid h-full place-items-center text-gray-600">Preparing preview…</div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : url ? (
            <iframe src={url} title="ID Preview" className="h-full w-full rounded" />
          ) : (
            <div className="grid h-full place-items-center text-gray-500">No preview available</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Page -------------------- */
function StaffPageInner() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [previewBlob, setPreviewBlob] = useState<Blob | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [previewFilename, setPreviewFilename] = useState<string | undefined>(undefined);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>(undefined);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | undefined>(undefined);

  const fetchStaff = async () => {
    try {
      const res = await axios.get('/staff');
      setStaff(Array.isArray(res.data) ? res.data : res.data?.staff ?? []);
    } catch (e) {
      console.error('Failed to fetch staff', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter((s) =>
      [s.name, s.role, s.phone, s.emergencyContact ?? '', s.barcode, s.user?.email ?? '']
        .some((v) => (v || '').toLowerCase().includes(term)),
    );
  }, [q, staff]);

  const onCreated = (newStaff: Staff) => {
    setStaff((prev) => [newStaff, ...prev]);
  };

  // Fetch PDF as blob and show preview modal (no navigation)
  const handlePreview = async (s: Staff) => {
    setPreviewError(undefined);
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewUrl(undefined);
    setPreviewBlob(undefined);
    try {
      const res = await axios.get(`/staff/${s.id}/id-card`, { responseType: 'blob' });
      const blob = res.data as Blob;
      setPreviewBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      const safeName = (s.name ?? 'staff').replace(/\s+/g, '_');
      setPreviewFilename(`${safeName}_id.pdf`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load ID card';
      setPreviewError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const parts = result.split(',');
        resolve(parts[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handlePrint = async () => {
    if (!previewBlob) return;
    try {
      const base64 = await blobToBase64(previewBlob);
      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Print ID Card</title>
<style>
  @page { size: 85.6mm 54mm; margin: 0; }
  html,body { height: 100%; margin: 0; padding: 0; }
  .wrap { width: 85.6mm; height: 54mm; margin: 0; }
  .wrap embed, .wrap object, .wrap iframe { width: 100%; height: 100%; border: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; }
    .wrap { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <embed src="data:application/pdf;base64,${base64}" type="application/pdf">
  </div>
<script>
  window.onload = function(){
    setTimeout(function(){ window.print(); }, 300);
  };
</script>
</body>
</html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to prepare printable view', err);
      alert('Failed to prepare printable view');
    }
  };

  const handleEdit = (s: Staff) => {
    setEditingStaff(s);
    setEditOpen(true);
  };

  const handleUpdated = (updated: Staff) => {
    setStaff((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDelete = (s: Staff) => {
    setStaffToDelete(s);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    try {
      await axios.delete(`/staff/${staffToDelete.id}`);
      setStaff((prev) => prev.filter((staff) => staff.id !== staffToDelete.id));
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Failed to delete staff');
    } finally {
      setDeleteConfirmOpen(false);
      setStaffToDelete(undefined);
    }
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setStaffToDelete(undefined);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(undefined);
    }
    setPreviewBlob(undefined);
    setPreviewError(undefined);
    setPreviewLoading(false);
  };

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Staff</h1>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, role, phone, barcode, email…"
            className="w-64 rounded-md border px-3 py-2"
          />
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            Add Staff
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg bg-white p-6 text-gray-600 shadow">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-gray-600 shadow">No staff found.</div>
      ) : (
        <StaffTable staff={filtered} onPreview={handlePreview} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <AddStaffModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={onCreated} />

      <EditStaffModal
        open={editOpen}
        staff={editingStaff}
        onClose={() => {
          setEditOpen(false);
          setEditingStaff(undefined);
        }}
        onUpdated={handleUpdated}
      />

      <PdfPreviewModal
        open={previewOpen}
        loading={previewLoading}
        url={previewUrl}
        filename={previewFilename}
        error={previewError}
        onClose={closePreview}
        onPrint={handlePrint}
      />

      <DeleteConfirmationModal
        open={deleteConfirmOpen}
        staffName={staffToDelete?.name ?? ''}
        onClose={closeDeleteConfirm}
        onConfirm={confirmDelete}
      />
    </Layout>
  );
}

export default function StaffPage() {
  return (
    <RequireAuth roles={['admin', 'manager']}>
      <StaffPageInner />
    </RequireAuth>
  );
}
