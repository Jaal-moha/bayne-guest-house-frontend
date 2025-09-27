// components/Layout.tsx
import { ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router'; // If you migrate to App Router, use: import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext';

type Role =
  | 'admin'
  | 'manager'
  | 'reception'
  | 'housekeeping'
  | 'barista'
  | 'security'
  | 'finance'
  | 'store';

type AppRole = Role | 'guest';

type MenuItem = { name: string; path: string; roles: Role[] };

const menuItems: MenuItem[] = [
  { name: 'Dashboard',  path: '/dashboard', roles: ['admin','manager','reception','finance'] },
  { name: 'Bookings',   path: '/bookings',  roles: ['admin','reception','manager'] },
  { name: 'Laundry',    path: '/laundry',   roles: ['admin','manager','reception'] },
  { name: 'Attendance', path: '/attendance',roles: ['admin','manager','reception'] },
  { name: 'Payments',   path: '/payments',  roles: ['admin','finance','manager','reception'] },
  { name: 'Inventory',  path: '/inventory', roles: ['admin','store','manager','barista'] }, // deduped 'store'
  { name: 'Rooms',      path: '/rooms',     roles: ['admin','reception','manager'] },
  { name: 'Staff',      path: '/staff',     roles: ['admin','manager'] },
  { name: 'Guests',     path: '/guests',    roles: ['admin','reception','manager'] },
];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter(); // App Router alt: const pathname = usePathname();
  const { user, logout } = useAuth();

  // Normalize role safely
  const role: AppRole = (user?.role as Role) ?? 'guest';

  // Active checker that works for nested paths
  const isActive = (path: string) =>
    router.pathname === path || router.pathname.startsWith(path + '/'); // App Router: pathname === path || pathname.startsWith(path + '/')

  // Only show items the role can see
  const visibleItems = useMemo(
    () => menuItems.filter(item => item.roles.includes(role as Role)),
    [role]
  );

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 flex-col bg-gray-800 text-white">
        <div className="border-b border-gray-700 p-4 text-xl font-bold">🏨 GuestHouse</div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-2">
          {visibleItems.map(item => (
            <Link
              key={item.name}
              href={item.path}
              className={`block rounded p-2 hover:bg-gray-700 ${isActive(item.path) ? 'bg-gray-700' : ''}`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between bg-white px-6 py-4 shadow">
          <div className="text-lg font-bold">
            Welcome{user?.name ? `, ${user.name}` : ''}
          </div>
          <div className="flex items-center gap-3">
            <input className="rounded-md border px-2 py-1" placeholder="Search..." />
            <span aria-label="notifications" title="Notifications">🔔</span>
            {user ? (
              <button onClick={logout} className="rounded-md border px-3 py-1 hover:bg-gray-50">
                Logout
              </button>
            ) : (
              <Link href="/login" className="rounded-md border px-3 py-1 hover:bg-gray-50">
                Login
              </Link>
            )}
          </div>
        </header>

        <div className="overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
