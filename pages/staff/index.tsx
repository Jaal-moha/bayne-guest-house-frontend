/* eslint-disable @typescript-eslint/no-explicit-any */
// pages/staff/index.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import { useToast } from '@/components/Toast';
import { useList } from '@/lib/useList';
import { PHOTO_HEIGHT, PHOTO_WIDTH, centerCrop, pdfFilename } from '@/lib/idCard';

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
  photoUpdatedAt: string | null;
};

const ROLE_VALUES = [
  'admin','manager','reception','housekeeping','barista','security','finance','store',
] as const;

/* -------------------- Photos -------------------- */
const photoKey = (s: Staff) => `${s.id}:${s.photoUpdatedAt}`;

// The photo route needs the bearer token, so photos come through axios as blobs, one per staff row
// with a photo, refetched only when photoUpdatedAt changes.
function usePhotoUrls(staff: Staff[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const latest = useRef(urls);
  latest.current = urls;

  const wanted = useMemo(
    () => new Map(staff.filter((s) => s.photoUpdatedAt).map((s) => [photoKey(s), s.id])),
    [staff],
  );

  useEffect(() => {
    const stale = Object.keys(urls).filter((k) => !wanted.has(k));
    if (stale.length) {
      stale.forEach((k) => URL.revokeObjectURL(urls[k]));
      setUrls((u) => Object.fromEntries(Object.entries(u).filter(([k]) => wanted.has(k))));
    }
    for (const [key, id] of wanted) {
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      axios
        .get(`/staff/${id}/photo`, { responseType: 'blob' })
        .then((res) => {
          const url = URL.createObjectURL(res.data as Blob);
          if (mounted.current) setUrls((u) => ({ ...u, [key]: url }));
          else URL.revokeObjectURL(url);
        })
        .catch(() => {});
    }
  }, [wanted, urls]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Object.values(latest.current).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  return (s: Staff) => (s.photoUpdatedAt ? urls[photoKey(s)] : undefined);
}

async function toPassportJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { sx, sy, sw, sh } = centerCrop(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  // JPEG has no alpha, so a transparent PNG would otherwise turn black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the photo'))), 'image/jpeg', 0.9),
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function PhotoThumb({ name, url, className }: { name: string; url?: string; className: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Photo of ${name}`} className={`${className} rounded object-cover`} />
  ) : (
    <div aria-hidden className={`${className} grid place-items-center rounded bg-gray-100 font-semibold text-gray-400`}>
      {initials(name)}
    </div>
  );
}

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
  // Set once POST /staff succeeds, so a retry after a failed account step never posts the staff record again.
  const [created, setCreated] = useState<Staff | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; id: number } | null>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [savedConfirmed, setSavedConfirmed] = useState(false);

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
      setCreated(null);
      setCreatedCreds(null);
      setCopy('idle');
      setSavedConfirmed(false);
      setCreateAccount(true);
      setStep(1);
      setEmail('');
      setPassword('');
    }
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (created) onCreated(created);
    onClose();
  };

  const copyCreds = async () => {
    if (!createdCreds) return;
    try {
      await navigator.clipboard.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

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

  const submit = async () => {
    setErr('');
    try {
      setLoading(true);
      let staff = created;
      if (!staff) {
        const res = await axios.post('/staff', {
          name: name.trim(),
          role,
          phone: phone.trim(),
          emergencyContact: emergencyContact.trim() || undefined,
        });
        staff = res.data as Staff;
        setCreated(staff);
      }
      if (!createAccount) {
        onCreated(staff);
        onClose();
        return;
      }
      const user = await axios.post(`/users/staff/${staff.id}`, { email: email.trim(), password, role });
      setCreated({ ...staff, user: user.data });
      setCreatedCreds({ email: email.trim(), password, id: staff.id });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to add staff';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={step === 1 ? 'Add Staff' : 'Review & Create'} size="md" locked={loading || !!createdCreds}>
      <p className="mt-1 text-sm text-gray-500">{step === 1 ? 'Enter staff details' : 'Confirm details and create staff'}</p>

      {err && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {created && !createdCreds && !loading && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {name} is saved as staff. Fix the email and try again to create the account.
        </div>
      )}

      {!createdCreds ? (
        <>
          {step === 1 ? (
            <div className="mt-4 space-y-3">
              <Field label="Full name">
                {(id) => (
                  <input
                    id={id}
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!!created}
                    placeholder="e.g. Sara Reception"
                  />
                )}
              </Field>

              <Field label="Role">
                {(id) => (
                  <select
                    id={id}
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={!!created}
                  >
                    <option value="" disabled>Select a role…</option>
                    {ROLE_VALUES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field label="Phone">
                {(id) => (
                  <input
                    id={id}
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!!created}
                    placeholder="+251 9xx xxx xxx"
                  />
                )}
              </Field>

              <Field label="Emergency contact (optional)">
                {(id) => (
                  <input
                    id={id}
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    disabled={!!created}
                    placeholder="Name / Phone"
                  />
                )}
              </Field>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="create-account"
                  type="checkbox"
                  checked={createAccount}
                  onChange={(e) => setCreateAccount(e.target.checked)}
                  disabled={!!created}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <label htmlFor="create-account" className="text-sm text-gray-700">
                  Create user account for this staff (recommended)
                </label>
              </div>

              {createAccount && (
                <Field label="Email">
                  {(id) => (
                    <input
                      id={id}
                      className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. sara@example.com"
                      type="email"
                    />
                  )}
                </Field>
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
                close();
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
                {loading ? 'Saving…' : created ? 'Retry Account' : createAccount ? 'Create Staff & Account' : 'Create Staff'}
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

          <div className="mt-3 text-sm" role="status">
            {copy === 'copied' && <span className="font-semibold text-green-700">Copied</span>}
            {copy === 'failed' && <span className="font-semibold text-red-700">Copy failed, select the password</span>}
          </div>
          {copy !== 'copied' && (
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={savedConfirmed} onChange={(e) => setSavedConfirmed(e.target.checked)} className="h-4 w-4" />
              I saved the password
            </label>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={close}
              disabled={copy !== 'copied' && !savedConfirmed}
              className="rounded-md border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              Done
            </button>
            <button
              onClick={copyCreds}
              className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
            >
              Copy Credentials
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* -------------------- Edit Staff Modal -------------------- */
function EditStaffModal({
  open,
  staff,
  photoUpdatedAt,
  photoUrl,
  onClose,
  onUpdated,
  onPhotoChanged,
}: {
  open: boolean;
  staff?: Staff | null;
  photoUpdatedAt: string | null;
  photoUrl?: string;
  onClose: () => void;
  onUpdated: (s: Staff) => void;
  onPhotoChanged: (staffId: number, photoUpdatedAt: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<'uploading' | 'removing' | null>(null);
  const [photoErr, setPhotoErr] = useState('');
  // The cropped JPEG being uploaded, shown until the saved photo has been fetched back.
  const [localPhoto, setLocalPhoto] = useState<string | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (localPhoto) URL.revokeObjectURL(localPhoto);
  }, [localPhoto]);

  useEffect(() => {
    setLocalPhoto(undefined);
    setPhotoErr('');
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

  const shownPhoto = photoBusy === 'uploading' ? localPhoto : photoUpdatedAt ? (photoUrl ?? localPhoto) : undefined;

  const pickPhoto = async (file: File | undefined) => {
    if (!file || !staff) return;
    setPhotoErr('');
    let blob: Blob;
    try {
      blob = await toPassportJpeg(file);
    } catch {
      return setPhotoErr('Could not read that image. Choose a JPEG or PNG photo.');
    }
    setLocalPhoto(URL.createObjectURL(blob));
    setPhotoBusy('uploading');
    try {
      const form = new FormData();
      form.append('photo', blob, 'photo.jpg');
      const res = await axios.put(`/staff/${staff.id}/photo`, form);
      onPhotoChanged(staff.id, res.data.photoUpdatedAt);
    } catch (e: any) {
      setLocalPhoto(undefined);
      const msg = e?.response?.data?.message || e?.message || 'Failed to upload photo';
      setPhotoErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setPhotoBusy(null);
    }
  };

  const removePhoto = async () => {
    if (!staff) return;
    setPhotoErr('');
    setPhotoBusy('removing');
    try {
      await axios.delete(`/staff/${staff.id}/photo`);
      setLocalPhoto(undefined);
      onPhotoChanged(staff.id, null);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to remove photo';
      setPhotoErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setPhotoBusy(null);
    }
  };

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
    <Modal open={open} onClose={onClose} title="Edit Staff" size="md" locked={loading || !!photoBusy}>
      <p className="mt-1 text-sm text-gray-500">Update staff member details</p>

      {err && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="mt-4 flex items-start gap-4">
        <PhotoThumb name={name || staff?.name || ''} url={shownPhoto} className="h-[135px] w-[105px] shrink-0 text-2xl" />
        <div className="min-w-0 space-y-2">
          <div className="text-sm font-medium text-gray-700">ID card photo</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!!photoBusy}
              className="rounded border px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {photoBusy === 'uploading' ? 'Uploading…' : photoUpdatedAt ? 'Change photo' : 'Choose photo'}
            </button>
            {photoUpdatedAt && (
              <button
                type="button"
                onClick={removePhoto}
                disabled={!!photoBusy}
                className="rounded bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {photoBusy === 'removing' ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            aria-label="ID card photo file"
            className="hidden"
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-gray-500">Cropped from the center to passport size, 35 x 45 mm.</p>
          {photoErr && <p className="text-sm text-red-600">{photoErr}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Full name">
          {(id) => (
            <input
              id={id}
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sara Reception"
            />
          )}
        </Field>

        <Field label="Role">
          {(id) => (
            <select
              id={id}
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
          )}
        </Field>

        <Field label="Phone">
          {(id) => (
            <input
              id={id}
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9xx xxx xxx"
            />
          )}
        </Field>

        <Field label="Emergency contact (optional)">
          {(id) => (
            <input
              id={id}
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Name / Phone"
            />
          )}
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} disabled={!!photoBusy} className="rounded-md border px-4 py-2 hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={loading || !!photoBusy}
          className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}

/* -------------------- Delete Confirmation Modal -------------------- */
function DeleteConfirmationModal({
  open,
  staffName,
  deleting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  staffName: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Confirm Deletion" size="md" locked={deleting}>
      <p className="mt-1 text-sm text-gray-500">
        Are you sure you want to delete <strong>{staffName}</strong> and their account? This action cannot be undone.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={deleting}
          className="rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}

/* -------------------- Staff Table -------------------- */
function StaffTable({
  staff,
  photoUrl,
  onPreview,
  onEdit,
  onDelete,
}: {
  staff: Staff[];
  photoUrl: (s: Staff) => string | undefined;
  onPreview?: (s: Staff) => void;
  onEdit?: (s: Staff) => void;
  onDelete?: (s: Staff) => void;
}) {
  return (
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
            <td className="px-4 py-2">
              <div className="flex items-center gap-3">
                <PhotoThumb name={s.name} url={photoUrl(s)} className="h-[45px] w-[35px] shrink-0 text-xs" />
                <span>{s.name}</span>
              </div>
            </td>
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
                      ID card
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
    <Modal open={open} onClose={onClose} title="ID card" size="3xl">
      <div className="flex items-center justify-end gap-2">
        {url && (
          <a
            href={url}
            download={filename}
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Download
          </a>
        )}
        {url && onPrint && (
          <button
            onClick={onPrint}
            className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
          >
            Print
          </button>
        )}
        <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Close</button>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Print on A4 at 100% (actual size), cut along the crop marks, fold on the dashed line, laminate.
      </p>

      <div className="mt-3 h-[70vh]">
        {loading ? (
          <div className="grid h-full place-items-center text-gray-600">Preparing preview…</div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : url ? (
          <iframe src={url} title="ID card PDF" className="h-full w-full rounded" />
        ) : (
          <div className="grid h-full place-items-center text-gray-500">No preview available</div>
        )}
      </div>
    </Modal>
  );
}

/* -------------------- Page -------------------- */
function StaffPageInner() {
  const staffList = useList<Staff>('staff', async () => {
    const res = await axios.get('/staff');
    return Array.isArray(res.data) ? res.data : res.data?.staff ?? [];
  });
  const { rows: staff, setRows: setStaff } = staffList;
  const { push } = useToast();
  const photoUrl = usePhotoUrls(staff);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [previewFilename, setPreviewFilename] = useState<string | undefined>(undefined);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>(undefined);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | undefined>(undefined);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter((s) =>
      [s.name, s.role, s.phone, s.emergencyContact ?? '', s.barcode, s.user?.email ?? '']
        .some((v) => (v || '').toLowerCase().includes(term)),
    );
  }, [q, staff]);

  const onCreated = (newStaff: Staff) => {
    setStaff((prev) => [newStaff, ...prev.filter((p) => p.id !== newStaff.id)]);
  };

  // Fetch PDF as blob and show preview modal (no navigation)
  const handlePreview = async (s: Staff) => {
    setPreviewError(undefined);
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewUrl(undefined);
    try {
      const res = await axios.get(`/staff/${s.id}/id-card`, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(res.data as Blob));
      setPreviewFilename(pdfFilename(res.headers['content-disposition'], s.id));
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load ID card';
      setPreviewError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePrint = () => {
    if (!previewUrl) return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    frame.onload = () => {
      try {
        frame.contentWindow?.print();
      } catch {
        window.open(previewUrl, '_blank');
      }
      // print() can return before the dialog closes, and removing the frame then would cancel it.
      setTimeout(() => frame.remove(), 60_000);
    };
    frame.src = previewUrl;
    document.body.appendChild(frame);
  };

  const handleEdit = (s: Staff) => {
    setEditingStaff(s);
    setEditOpen(true);
  };

  const handleUpdated = (updated: Staff) => {
    setStaff((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handlePhotoChanged = (staffId: number, photoUpdatedAt: string | null) => {
    setStaff((prev) => prev.map((p) => (p.id === staffId ? { ...p, photoUpdatedAt } : p)));
  };

  const editingRow = staff.find((s) => s.id === editingStaff?.id);

  const handleDelete = (s: Staff) => {
    setStaffToDelete(s);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    setDeletePending(true);
    try {
      await axios.delete(`/staff/${staffToDelete.id}`);
      setStaff((prev) => prev.filter((staff) => staff.id !== staffToDelete.id));
    } catch (error) {
      console.error('Error deleting staff:', error);
      push('Failed to delete staff', 'error');
    } finally {
      setDeletePending(false);
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
    setPreviewError(undefined);
    setPreviewLoading(false);
  };

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Staff</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/staff/id-card-demo" className="rounded-md border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Card options (demo)
          </Link>
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

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <ListState list={staffList} empty="No staff found.">
          {filtered.length === 0 ? (
            <div className="p-6 text-gray-600">No staff found.</div>
          ) : (
            <StaffTable staff={filtered} photoUrl={photoUrl} onPreview={handlePreview} onEdit={handleEdit} onDelete={handleDelete} />
          )}
        </ListState>
      </div>

      <AddStaffModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={onCreated} />

      <EditStaffModal
        open={editOpen}
        staff={editingStaff}
        photoUpdatedAt={editingRow?.photoUpdatedAt ?? null}
        photoUrl={editingRow && photoUrl(editingRow)}
        onPhotoChanged={handlePhotoChanged}
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
        deleting={deletePending}
        onClose={closeDeleteConfirm}
        onConfirm={confirmDelete}
      />
    </Layout>
  );
}

export default function StaffPage() {
  return (
    <RequireAuth>
      <StaffPageInner />
    </RequireAuth>
  );
}
