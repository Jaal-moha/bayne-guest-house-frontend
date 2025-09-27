import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      console.log('RequireAuth check:', { user, roles });
      if (!user) router.replace('/login');
      else if (roles && roles.length && !roles.includes(user.role)) router.replace('/dashboard');
    }
  }, [loading, user, roles, router]);

  if (loading) return <div className="grid min-h-screen place-items-center">Loading…</div>;
  if (!user) return null;
  if (roles && roles.length && !roles.includes(user.role)) return null;

  return <>{children}</>;
}
