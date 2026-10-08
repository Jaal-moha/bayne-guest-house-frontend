import { ReactNode, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { PAGES, pagesFor } from '@/lib/permissions';

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) =>
    router.pathname === path || router.pathname.startsWith(path + '/');

  const visibleItems = user ? pagesFor(user.role) : [];
  const pageLabel = PAGES.find(page => isActive(page.path))?.label;

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-screen">
      <Head>
        <title>{pageLabel ? `${pageLabel} · Almis Hotel` : 'Almis Hotel'}</title>
      </Head>

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="sidebar"
        className={`${menuOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 w-64 flex-col bg-gray-800 text-white md:static md:flex`}
      >
        <div className="border-b border-gray-700 p-4 text-xl font-bold">Almis Hotel</div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-2">
          {visibleItems.map(item => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMenuOpen(false)}
              className={`block rounded p-2 hover:bg-gray-700 ${isActive(item.path) ? 'bg-gray-700' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {user && (
          <div className="border-t border-gray-700 p-2 md:hidden">
            <button onClick={logout} className="w-full rounded p-2 text-left hover:bg-gray-700">
              Logout
            </button>
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 bg-white px-4 py-4 shadow md:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-md border px-3 py-1 md:hidden"
            aria-label="Open menu"
            aria-controls="sidebar"
            aria-expanded={menuOpen}
          >
            Menu
          </button>
          <div className="min-w-0 flex-1 truncate text-lg font-bold">
            Welcome{user?.name ? `, ${user.name}` : ''}
          </div>
          {user ? (
            <button onClick={logout} className="hidden rounded-md border px-3 py-1 hover:bg-gray-50 md:block">
              Logout
            </button>
          ) : (
            <Link href="/login" className="rounded-md border px-3 py-1 hover:bg-gray-50">
              Login
            </Link>
          )}
        </header>

        <div className="overflow-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
