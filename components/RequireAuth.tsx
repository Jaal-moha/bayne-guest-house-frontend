import { useAuth } from '@/context/AuthContext';
import { canOpen, homeFor } from '@/lib/permissions';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && canOpen(user, router.pathname);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!allowed) router.replace(homeFor(user) ?? '/');
  }, [loading, user, allowed, router]);

  if (loading) return <div className="grid min-h-screen place-items-center">Loading…</div>;
  if (!allowed) return null;

  return <>{children}</>;
}
