import { FormEvent, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { isAxiosError } from 'axios';
import axios from '@/utils/axiosInstance';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { landingFor } from '@/lib/permissions';

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

      <div className="grid min-h-screen place-items-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">Change password</h1>
            <p className="mt-1 text-sm text-gray-500">
              {user?.forceChangePassword
                ? 'Choose a new password to continue.'
                : 'Enter your current password and a new one.'}
            </p>
          </div>

          {err && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-gray-700">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Change password'}
            </button>
          </form>

          <button onClick={logout} className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700">
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
