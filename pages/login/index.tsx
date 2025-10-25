import { FormEvent, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // If already logged in, bounce to dashboard
  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      // AuthContext.login already routes to /dashboard; this is just a safety net:
      router.replace('/dashboard');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Login failed. Please check your email and password.';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign in • Almis Hotel</title>
      </Head>

      <div className="min-h-screen grid grid-cols-10">
        <div
          className="hidden md:block md:col-span-7 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/gps-cs-s/AC9h4nogPp2P4sSnMKZYVxPCzmyMzr_cREr_ayZpzkGUmiXEPCja54oMSFPXG08QthTw2SP4pI5_J8eJnVNgR2Eohu_vZD73STrCDRyws_Pfr8OgKQ86kFgmQS3wcZLsGqduw9-0NuiB=s680-w680-h510-rw')",
          }}
          aria-hidden="true"
        />

        <div className="col-span-10 md:col-span-3 flex items-center justify-center px-4 bg-gray-50/80">
          <div className="w-full max-w-md">
            <div className="rounded-2xl bg-white shadow p-6 sm:p-8">
              <div className="mb-6 text-center">
                <h1 className="text-xl font-bold text-gray-900">Almis Hotel</h1>
                <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
              </div>

              {err && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
                  <div className="flex rounded-md border focus-within:ring-2 focus-within:ring-indigo-500">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full rounded-l-md px-3 py-2 outline-none"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="rounded-r-md border-l bg-gray-50 px-3 text-sm text-gray-600 hover:bg-gray-100"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                    Remember me
                  </label>
                  <Link href="#" className="text-sm text-indigo-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Trouble signing in? Contact your administrator.
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
