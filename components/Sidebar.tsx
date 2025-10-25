import Link from 'next/link';

const links = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Bookings', path: '/bookings' },
  { name: 'Guests', path: '/guests' },
  { name: 'Rooms', path: '/rooms' },
  { name: 'Laundry', path: '/laundry' },
  { name: 'Attendance', path: '/attendance' },
  { name: 'Inventory', path: '/inventory' },
  { name: 'Payments', path: '/payments' },
  { name: 'Staff', path: '/staff' },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-white border-r shadow-md p-4">
      <h2 className="text-xl font-bold mb-6">Almis Hotel</h2>
      <ul className="space-y-2">
        {links.map(link => (
          <li key={link.name}>
            <Link href={link.path} className="block p-2 rounded hover:bg-gray-200">
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
