import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/lib/permissions';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const landing = user ? homeFor(user) : null;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (landing) router.replace(landing);
  }, [loading, user, landing, router]);

  if (!user || landing) return null;

  return (
    <Layout>
      <div className="mx-auto mt-16 max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">No pages for your role</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your account is signed in, but no page is open to the {user.role} role. Ask your administrator for access.
        </p>
      </div>
    </Layout>
  );
}
