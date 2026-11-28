'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const links = [
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
] as const;

function NavigationLinks({ close = false }: { close?: boolean }) {
  const items = links.map(([path, label]) => {
    const href = `/admin${path ? `/${path}` : ''}`;
    const className =
      'flex min-h-11 items-center rounded-lg px-3 font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2';
    return close ? (
      <DialogClose asChild key={path}>
        <Link className={className} href={href}>
          {label}
        </Link>
      </DialogClose>
    ) : (
      <Link key={path} className={className} href={href}>
        {label}
      </Link>
    );
  });
  return <div className="grid gap-1">{items}</div>;
}

export function AdminSidebar() {
  return (
    <>
      <div className="border-b bg-secondary">
        <div className="site-container flex items-center justify-between py-3">
          <p className="font-semibold">Administration</p>
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-background px-4 font-medium"
                aria-label="Open admin menu"
              >
                <Menu aria-hidden="true" className="size-5" />
                Menu
              </button>
            </DialogTrigger>
            <DialogContent variant="sheet" aria-label="Admin navigation">
              <DialogTitle>Administration</DialogTitle>
              <DialogDescription>Choose a store management page.</DialogDescription>
              <nav aria-label="Administration" className="mt-6">
                <NavigationLinks close />
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <aside className="site-container hidden py-6 lg:block">
        <nav aria-label="Administration">
          <NavigationLinks />
        </nav>
      </aside>
    </>
  );
}
