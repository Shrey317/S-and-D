import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireIdentity } from '@/server/auth/identity';
import { signOutAction } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your account' };
export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireIdentity();
  return (
    <main id="main-content" className="site-container py-12 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside>
          <p className="eyebrow">Your account</p>
          <nav aria-label="Account navigation" className="mt-5 flex flex-wrap gap-2 lg:grid">
            {[
              ['/account', 'Overview'],
              ['/account/profile', 'Profile'],
              ['/account/orders', 'Orders'],
              ['/account/addresses', 'Addresses'],
              ['/account/wishlist', 'Wishlist'],
              ['/account/security', 'Security'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href!}
                className="rounded-lg border px-4 py-3 text-sm font-semibold hover:bg-secondary"
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction} className="mt-5">
            <Button variant="outline" type="submit">
              Sign out everywhere
            </Button>
          </form>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
