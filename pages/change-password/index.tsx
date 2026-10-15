import { FormEvent, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { isAxiosError } from 'axios';
import axios from '@/utils/axiosInstance';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { landingFor } from '@/lib/permissions';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import { Input } from '@/components/Input';
import Panel from '@/components/Panel';

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordForm />
    </RequireAuth>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const { user, refresh, logout } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await axios.post('/auth/change-password', { currentPassword, newPassword });
      await refresh();
      toast.push('Password changed', 'success');
      router.replace((user && landingFor(user.role)) ?? '/');
    } catch (e) {
      const msg = isAxiosError(e) ? e.response?.data?.message : undefined;
      const text = Array.isArray(msg) ? msg.join(', ') : msg || 'Could not change the password. Try again.';
      if (isAxiosError(e) && e.response?.status === 409) {
        toast.push(text, 'error');
        logout();
        return;
      }
      setErr(text);
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Change password · Almis Hotel</title>
      </Head>

      <div className="grid min-h-screen place-items-center bg-page px-4">
        <Panel className="w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold tracking-tight">Change password</h1>
            <p className="mt-1 text-sm text-muted">
              {user?.forceChangePassword
                ? 'Choose a new password to continue.'
                : 'Enter your current password and a new one.'}
            </p>
          </div>

          {err && (
            <Alert className="mb-4">
              {err}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-ink">
                Current password
              </label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-ink">
                New password
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Saving…' : 'Change password'}
            </Button>
          </form>

          <Button variant="text" size="sm" onClick={logout} className="mt-4 w-full">
            Sign out
          </Button>
        </Panel>
      </div>
    </>
  );
}
