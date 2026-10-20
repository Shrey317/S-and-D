import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { serverEnv } from '@/config/env.server';
import { business } from '@/config/business';
import { ThemeProvider } from '@/components/theme-provider';
import { Header } from '@/components/storefront/header';
import { Footer } from '@/components/storefront/footer';
import { readStore, readStoreCategories } from '@/server/admin/store';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(serverEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${business.name} | Fresh produce in Lenasia`,
    template: `%s | ${business.name}`,
  },
  description:
    'Fruit, vegetables and everyday extras in Lenasia. Explore our storefront preview. Online ordering is coming soon.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  const [store, categories] = await Promise.all([readStore(), readStoreCategories()]);
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main-content"
          tabIndex={0}
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-card focus:p-4 focus:text-primary"
        >
          Skip to content
        </a>
        <ThemeProvider nonce={nonce}>
          <Header
            announcement={store.announcement}
            categoryLinks={categories.map((c) => ({ name: c.name, slug: c.slug }))}
          />
          {serverEnv.CATALOG_ALLOW_SAMPLES ? (
            <div
              role="region"
              aria-label="Development catalog notice"
              className="border-b border-accent bg-accent/15 px-6 py-3 text-center text-sm font-semibold"
            >
              Development catalog · Sample prices, pack sizes and stock · Not for sale
            </div>
          ) : null}
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
