/* eslint-disable @typescript-eslint/no-explicit-any */
// pages/staff/index.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import ListState from '@/components/ListState';
import Modal from '@/components/Modal';
import Field from '@/components/Field';
import Alert from '@/components/Alert';
import Button, { buttonClass } from '@/components/Button';
import { Input, Select } from '@/components/Input';
import Panel from '@/components/Panel';
import { Chip } from '@/components/StatusChip';
import Table from '@/components/Table';
import { Plus, Printer } from '@phosphor-icons/react';
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
    <img src={url} alt={`Photo of ${name}`} className={`${className} rounded-input object-cover`} />
  ) : (
    <div aria-hidden className={`${className} grid place-items-center rounded-input bg-slate-tint font-semibold text-muted`}>
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
      <p className="mt-1 text-sm text-muted">{step === 1 ? 'Enter staff details' : 'Confirm details and create staff'}</p>

      {err && (
        <Alert className="mt-3">
          {err}
        </Alert>
      )}

      {created && !createdCreds && !loading && (
        <Alert tone="neutral" className="mt-3">
          {name} is saved as staff. Fix the email and try again to create the account.
        </Alert>
      )}

      {!createdCreds ? (
        <>
          {step === 1 ? (
            <div className="mt-4 space-y-3">
              <Field label="Full name">
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!!created}
                    placeholder="e.g. Sara Reception"
                  />
                )}
              </Field>

              <Field label="Role">
                {(id) => (
                  <Select
                    id={id}
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
                  </Select>
                )}
              </Field>

              <Field label="Phone">
                {(id) => (
                  <Input
                    id={id}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!!created}
                    placeholder="+251 9xx xxx xxx"
                  />
                )}
              </Field>

              <Field label="Emergency contact (optional)">
                {(id) => (
                  <Input
                    id={id}
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
                  className="accent-accent size-4"
                />
                <label htmlFor="create-account" className="text-sm text-ink">
                  Create user account for this staff (recommended)
                </label>
              </div>

              {createAccount && (
                <Field label="Email">
                  {(id) => (
                    <Input
                      id={id}
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
                <div className="text-sm text-ink"><strong>Name:</strong> {name}</div>
                <div className="text-sm text-ink"><strong>Role:</strong> {role}</div>
                <div className="text-sm text-ink"><strong>Phone:</strong> {phone}</div>
              </div>

              {createAccount ? (
                <div className="rounded-input border border-line-soft bg-page p-3">
                  <div className="text-sm text-ink"><strong>Email:</strong> {email}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted">Generated password</div>
                      <div className="font-mono">{password}</div>
                    </div>
                    <div>
                      <Button size="sm" onClick={() => setPassword(genPassword())} className="ml-2">
                        Regenerate
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    The staff will use this email and password to sign in. They will be required to change the password on first login.
                  </div>
                </div>
              ) : (
                <Alert tone="neutral">
                  No user account will be created. You can create one later from the staff details.
                </Alert>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="text"
              onClick={() => {
                if (step === 2) {
                  setStep(1);
                  setErr('');
                  return;
                }
                close();
              }}
              disabled={loading}
            >
              {step === 2 ? 'Back' : 'Cancel'}
            </Button>

            {step === 1 ? (
              <Button variant="primary" onClick={proceedToReview}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={submit} disabled={loading}>
                {loading ? 'Saving…' : created ? 'Retry Account' : createAccount ? 'Create Staff & Account' : 'Create Staff'}
              </Button>
            )}
          </div>
        </>
      ) : (
        <Alert tone="accent" className="mt-4">
          <div>Staff created{createdCreds.id ? ` (ID: ${createdCreds.id})` : ''}.</div>
          <div className="mt-2">
            <strong>Email:</strong> <code className="ml-1">{createdCreds.email}</code>
          </div>
          <div className="mt-1">
            <strong>Password:</strong> <code className="ml-1">{createdCreds.password}</code>
          </div>
          <div className="mt-2 text-xs text-ink">Credentials must be delivered to the staff member. They will be required to change the password on first login.</div>

          <div className="mt-3 text-sm" role="status">
            {copy === 'copied' && <span className="font-semibold text-accent">Copied</span>}
            {copy === 'failed' && <span className="font-semibold text-danger">Copy failed, select the password</span>}
          </div>
          {copy !== 'copied' && (
            <label className="mt-2 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={savedConfirmed} onChange={(e) => setSavedConfirmed(e.target.checked)} className="accent-accent size-4" />
              I saved the password
            </label>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="quiet" onClick={close} disabled={copy !== 'copied' && !savedConfirmed}>
              Done
            </Button>
            <Button variant="primary" onClick={copyCreds}>
              Copy Credentials
            </Button>
          </div>
        </Alert>
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
      <p className="mt-1 text-sm text-muted">Update staff member details</p>

      {err && (
        <Alert className="mt-3">
          {err}
        </Alert>
      )}

      <div className="mt-4 flex items-start gap-4">
        <PhotoThumb name={name || staff?.name || ''} url={shownPhoto} className="h-[135px] w-[105px] shrink-0 text-2xl" />
        <div className="min-w-0 space-y-2">
          <div className="text-[13px] font-semibold text-ink">ID card photo</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="button" onClick={() => fileInput.current?.click()} disabled={!!photoBusy}>
              {photoBusy === 'uploading' ? 'Uploading…' : photoUpdatedAt ? 'Change photo' : 'Choose photo'}
            </Button>
            {photoUpdatedAt && (
              <Button size="sm" type="button" variant="danger-quiet" onClick={removePhoto} disabled={!!photoBusy}>
                {photoBusy === 'removing' ? 'Removing…' : 'Remove'}
              </Button>
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
          <p className="text-[13px] text-muted">Cropped from the center to passport size, 35 x 45 mm.</p>
          {photoErr && <p className="text-sm text-danger">{photoErr}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Full name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sara Reception"
            />
          )}
        </Field>

        <Field label="Role">
          {(id) => (
            <Select
              id={id}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="" disabled>Select a role…</option>
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Phone">
          {(id) => (
            <Input
              id={id}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9xx xxx xxx"
            />
          )}
        </Field>

        <Field label="Emergency contact (optional)">
          {(id) => (
            <Input
              id={id}
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Name / Phone"
            />
          )}
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose} disabled={!!photoBusy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={loading || !!photoBusy}>
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
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
      <p className="mt-1 text-sm text-muted">
        Are you sure you want to delete <strong>{staffName}</strong> and their account? This action cannot be undone.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleting}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}

/* -------------------- Staff Table -------------------- */
const CHECKBOX = 'accent-accent size-4';

function SelectAllBox({ checked, partial, onChange }: { checked: boolean; partial: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  return <input ref={ref} type="checkbox" className={CHECKBOX} aria-label="Select all staff" checked={checked} onChange={onChange} />;
}

function StaffTable({
  staff,
  photoUrl,
  selected,
  onToggle,
  onToggleAll,
  onPreview,
  onEdit,
  onDelete,
}: {
  staff: Staff[];
  photoUrl: (s: Staff) => string | undefined;
  selected: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onPreview?: (s: Staff) => void;
  onEdit?: (s: Staff) => void;
  onDelete?: (s: Staff) => void;
}) {
  const selectedCount = staff.filter((s) => selected.has(s.id)).length;
  return (
    <Table className="border-collapse">
      <thead>
        <tr>
          <th className="w-10">
            <SelectAllBox
              checked={selectedCount > 0 && selectedCount === staff.length}
              partial={selectedCount > 0 && selectedCount < staff.length}
              onChange={onToggleAll}
            />
          </th>
          <th>Name</th>
          <th>Role</th>
          <th>Phone</th>
          <th>Emergency</th>
          <th>Barcode</th>
          <th>Account</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {staff.map((s) => (
          <tr key={s.id}>
            <td>
              <input
                type="checkbox"
                className={CHECKBOX}
                aria-label={`Select ${s.name}`}
                checked={selected.has(s.id)}
                onChange={() => onToggle(s.id)}
              />
            </td>
            <td>
              <div className="flex items-center gap-3">
                <PhotoThumb name={s.name} url={photoUrl(s)} className="h-[45px] w-[35px] shrink-0 text-xs" />
                <span className="font-semibold">{s.name}</span>
              </div>
            </td>
            <td>{s.role}</td>
            <td>{s.phone}</td>
            <td>{s.emergencyContact || <span className="text-muted">—</span>}</td>
            <td className="font-mono text-sm tabular-nums">{s.barcode}</td>
            <td>
              {s.user ? (
                <Chip tone="accent">
                  {s.user.email}
                </Chip>
              ) : (
                <span className="text-muted">No account</span>
              )}
            </td>
            <td>
              <div className="flex gap-2">
                {s.id ? (
                  <>
                    <Button size="sm" onClick={() => onPreview?.(s)}>
                      ID card
                    </Button>
                    <Button size="sm" onClick={() => onEdit?.(s)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger-quiet" onClick={() => onDelete?.(s)}>
                      Delete
                    </Button>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/* -------------------- PDF Preview Modal -------------------- */
function PdfPreviewModal({
  open,
  title,
  loading,
  url,
  filename,
  onClose,
  error,
  onPrint,
}: {
  open: boolean;
  title: string;
  loading: boolean;
  url?: string;
  filename?: string;
  error?: string;
  onClose: () => void;
  onPrint?: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} size="3xl">
      <div className="flex items-center justify-end gap-2">
        {url && (
          <a
            href={url}
            download={filename}
            className={buttonClass('primary', 'sm')}
          >
            Download
          </a>
        )}
        {url && onPrint && (
          <Button size="sm" onClick={onPrint}>
            Print
          </Button>
        )}
        <Button size="sm" variant="text" onClick={onClose}>Close</Button>
      </div>
      <p className="mt-3 text-sm text-muted">
        Print on A4 at 100% (actual size). Each page holds three cards: cut on the corner marks, fold on the dashed
        line, laminate.
      </p>

      <div className="mt-3 h-[70vh]">
        {loading ? (
          <div className="grid h-full place-items-center text-muted">Preparing preview…</div>
        ) : error ? (
          <Alert>{error}</Alert>
        ) : url ? (
          <iframe src={url} title="ID card PDF" className="h-full w-full rounded" />
        ) : (
          <div className="grid h-full place-items-center text-muted">No preview available</div>
        )}
      </div>
    </Modal>
  );
}

/* -------------------- Page -------------------- */
const MAX_PRINT_BATCH = 30;

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
  const [previewTitle, setPreviewTitle] = useState('ID card');

  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

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

  const printIds = filtered.filter((s) => selected.has(s.id)).map((s) => s.id);

  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = filtered.every((s) => prev.has(s.id));
      for (const s of filtered) {
        if (allOn) next.delete(s.id);
        else next.add(s.id);
      }
      return next;
    });

  const onCreated = (newStaff: Staff) => {
    setStaff((prev) => [newStaff, ...prev.filter((p) => p.id !== newStaff.id)]);
  };

  const openPdf = async (title: string, path: string, fallbackFilename: string) => {
    setPreviewTitle(title);
    setPreviewError(undefined);
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewUrl(undefined);
    try {
      const res = await axios.get(path, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(res.data as Blob));
      setPreviewFilename(pdfFilename(res.headers['content-disposition'], fallbackFilename));
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load ID card';
      setPreviewError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreview = (s: Staff) => openPdf('ID card', `/staff/${s.id}/id-card`, `staff-${s.id}.pdf`);

  const printSelected = () =>
    openPdf(
      `ID cards (${printIds.length})`,
      `/staff/id-cards?ids=${printIds.join(',')}`,
      `staff-cards-${printIds.length}.pdf`,
    );

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
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(staffToDelete.id);
        return next;
      });
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
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, role, phone, barcode, email…"
            className="sm:w-64"
          />
          <Button
            icon={Printer}
            onClick={printSelected}
            disabled={printIds.length === 0 || printIds.length > MAX_PRINT_BATCH}
            title={printIds.length > MAX_PRINT_BATCH ? `Select at most ${MAX_PRINT_BATCH} staff` : undefined}
          >
            Print selected ({printIds.length})
          </Button>
          {selected.size > 0 && (
            <Button variant="text" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          )}
          <Button variant="primary" icon={Plus} onClick={() => setModalOpen(true)}>
            Add Staff
          </Button>
        </div>
      </div>

      <Panel className="overflow-x-auto">
        <ListState list={staffList} empty="No staff found.">
          {filtered.length === 0 ? (
            <div className="p-6 text-muted">No staff found.</div>
          ) : (
            <StaffTable
              staff={filtered}
              photoUrl={photoUrl}
              selected={selected}
              onToggle={toggleSelected}
              onToggleAll={toggleAllVisible}
              onPreview={handlePreview}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </ListState>
      </Panel>

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
        title={previewTitle}
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
