import Link from 'next/link';
import { ArrowUpRight, Phone } from 'lucide-react';
import { Logo } from './logo';
import { readStore, readStoreCategories } from '@/server/admin/store';
import { displayPhone } from '@/lib/phone';

export async function Footer() {
  const [store, categories] = await Promise.all([readStore(), readStoreCategories()]);
  return (
    <footer className="brand-panel">
      <div className="site-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <Logo inverse />
          <p className="mt-6 max-w-xs text-sm leading-7 text-white/75">
            Freshness You Can Trust.
            <br />
            Quality You Can Taste.
          </p>
          <p className="mt-4 text-xs text-white/65">Your neighbourhood shop in Lenasia.</p>
        </div>
        <div>
          <h2 className="footer-heading">Explore</h2>
          <ul className="footer-links">
            <li>
              <Link href="/shop">Shop preview</Link>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/shop?category=${category.slug}`}>{category.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">Good to know</h2>
          <ul className="footer-links">
            <li>
              <Link href="/about">About S & D</Link>
            </li>
            <li>
              <Link href="/delivery-and-collection">Delivery & collection</Link>
            </li>
            <li>
              <Link href="/contact">Contact us</Link>
            </li>
            <li>
              <Link href="/policies">Store policies</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">Come say hello</h2>
          <address className="mt-5 text-sm leading-7 text-white/75 not-italic">
            {store.address}
          </address>
          <a
            href={`tel:${store.phone}`}
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium"
          >
            <Phone className="size-4" aria-hidden="true" />
            {displayPhone(store.phone)}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <p className="mt-2 text-xs leading-6 text-white/70">
            Mon–Sat {store.weekdayOpen}–{store.weekdayClose}
            <br />
            Sunday {store.sundayOpen}–{store.sundayClose}
          </p>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="site-container flex flex-col gap-3 py-6 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} S & D Fruit and Veg</p>
          <p>Storefront preview · Online ordering is not yet available</p>
          <Link href="/image-credits" className="underline underline-offset-4">
            Illustrative photography credits
          </Link>
        </div>
      </div>
    </footer>
  );
}
