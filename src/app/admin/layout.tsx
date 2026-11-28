import { notFound } from 'next/navigation';
import { isAdministrator } from '@/server/auth/identity';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdministrator())) notFound();
  return (
    <>
      <AdminSidebar />
      {children}
    </>
  );
}
