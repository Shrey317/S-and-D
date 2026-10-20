'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, Search, ShoppingBasket, Truck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ThemeToggle } from './theme-toggle';
import { Logo } from './logo';
import { categories } from '@/config/categories';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'Our story' },
  { href: '/contact', label: 'Contact' },
  { href: '/account', label: 'My account' },
];

export function Header({
  announcement = 'Free delivery in eligible Lenasia areas',
  categoryLinks = categories,
}: {
  announcement?: string;
  categoryLinks?: readonly { name: string; slug: string }[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  return (
    <>
      <div className="announcement" role="region" aria-label="Store announcements">
        <div className="site-container flex min-h-10 flex-wrap items-center justify-center gap-x-6 gap-y-1 py-2 text-center text-xs sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <Truck className="size-3.5" aria-hidden="true" />
            {announcement}
          </span>
          <span>
            Online ordering coming soon <span aria-hidden="true">·</span> Storefront preview
          </span>
        </div>
      </div>
      <header className="site-header border-b border-border/60 bg-background/95">
        <div className="site-container flex min-h-24 flex-wrap items-center justify-between gap-3 py-3">
          <Logo />
          <nav
            aria-label="Main navigation"
            className="hidden min-w-0 flex-wrap items-center gap-x-8 gap-y-2 lg:flex"
          >
            {navigation.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
                className={cn(
                  'nav-link py-3 text-sm font-medium',
                  pathname === href
                    ? 'text-primary after:scale-x-100'
                    : 'text-muted-foreground hover:text-primary',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Browse categories"
                  className="hidden sm:inline-flex"
                >
                  <Search aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Explore the categories</DialogTitle>
                <DialogDescription>
                  Explore our categories. Online ordering is coming soon.
                </DialogDescription>
                <div className="mt-6 grid gap-2">
                  {categoryLinks.map((category) => (
                    <DialogClose asChild key={category.slug}>
                      <Link
                        className="flex min-h-12 items-center justify-between rounded-lg bg-secondary px-4 py-3 font-medium"
                        href={`/shop?category=${category.slug}`}
                      >
                        {category.name}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </DialogClose>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
              <Link href="/account" aria-label="Your account">
                <UserRound aria-hidden="true" />
              </Link>
            </Button>
            <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open basket">
                  <ShoppingBasket aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent variant="sheet">
                <DialogTitle>Your basket</DialogTitle>
                <DialogDescription>Review your fresh picks and pack sizes.</DialogDescription>
                <div className="mt-12 rounded-2xl bg-secondary px-6 py-10 text-center">
                  <ShoppingBasket
                    className="mx-auto mb-5 size-12 text-primary"
                    strokeWidth={1.25}
                    aria-hidden="true"
                  />
                  <h3 className="text-xl font-semibold">Your fresh picks, saved.</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    View your saved basket to update quantities and review current prices. Checkout
                    is a local test preview only.
                  </p>
                </div>
                <DialogClose asChild>
                  <Button asChild className="mt-6 w-full">
                    <Link href="/cart">
                      View basket
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="ghost" className="mt-2 w-full">
                    Continue browsing
                  </Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent variant="sheet">
                <DialogTitle>Welcome to S & D</DialogTitle>
                <DialogDescription>Your neighbourhood fruit and veg shop.</DialogDescription>
                <nav aria-label="Mobile navigation" className="mt-8 grid gap-2">
                  {navigation.map(({ href, label }) => (
                    <DialogClose asChild key={href}>
                      <Link
                        href={href}
                        aria-current={pathname === href ? 'page' : undefined}
                        className="flex min-h-14 items-center justify-between rounded-xl px-4 text-xl font-medium hover:bg-secondary"
                      >
                        {label}
                        <ArrowRight className="size-5" aria-hidden="true" />
                      </Link>
                    </DialogClose>
                  ))}
                </nav>
                <p className="mt-10 border-t pt-6 text-sm leading-relaxed text-muted-foreground">
                  Visit us at 155 Gemsbok Street, Lenasia.
                  <br />
                  Online ordering is not yet available.
                </p>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
    </>
  );
}
