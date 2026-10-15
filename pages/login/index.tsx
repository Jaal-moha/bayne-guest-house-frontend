import { FormEvent, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/lib/permissions';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import { Input } from '@/components/Input';
import Panel from '@/components/Panel';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user) router.replace(homeFor(user) ?? '/');
  }, [user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email.trim(), password);
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
        <title>Sign in · Almis Hotel</title>
      </Head>

      <div className="min-h-screen grid grid-cols-10">
        <div
          className="hidden md:block md:col-span-7 bg-cover bg-center"
          style={{ backgroundImage: "url('/login-hotel.jpg')" }}
          aria-hidden="true"
        />

        <div className="col-span-10 md:col-span-3 flex items-center justify-center px-4 bg-page/80">
          <div className="w-full max-w-md">
            <Panel className="p-6 sm:p-8">
              <div className="mb-6 text-center">
                <h1 className="text-xl font-bold tracking-tight">Almis Hotel</h1>
                <p className="mt-1 text-sm text-muted">Sign in to continue</p>
              </div>

              {err && (
                <Alert className="mb-4">
                  {err}
                </Alert>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Password</label>
                  <div className="flex min-h-11 rounded-input border border-line bg-surface transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-tint">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full rounded-l-input bg-transparent px-3.5 text-[15px] text-ink outline-none placeholder:text-muted"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="rounded-r-input border-l border-line bg-page px-3 text-sm font-semibold text-muted transition-colors hover:bg-slate-tint hover:text-ink"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            </Panel>

            <p className="mt-4 text-center text-xs text-muted">
              Trouble signing in? Contact your administrator.
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
