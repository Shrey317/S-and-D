import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdministrator } from '@/server/auth/identity';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdministrator())) notFound();
  return (
    <>
      <nav aria-label="Administration" className="border-b bg-secondary">
        <div className="site-container flex flex-wrap gap-x-5 gap-y-2 py-4">
          {[
            ['', 'Overview'],
            ['products', 'Products'],
            ['categories', 'Categories'],
            ['inventory', 'Inventory'],
            ['orders', 'Orders'],
            ['customers', 'Customers'],
            ['promotions', 'Promotions'],
            ['payments', 'Payments / refunds'],
            ['notifications', 'Notifications'],
            ['communications', 'Communications'],
            ['reports', 'Reports'],
            ['settings', 'Settings'],
            ['audit-logs', 'Audit history'],
          ].map(([path, label]) => (
            <Link
              key={path}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              href={`/admin${path ? `/${path}` : ''}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
