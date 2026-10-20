import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '@/components/storefront/page-intro';
import { Button } from '@/components/ui/button';
import { readStore } from '@/server/admin/store';

export const metadata: Metadata = { title: 'About our shop' };

export default async function AboutPage() {
  const store = await readStore();
  return (
    <main id="main-content" tabIndex={-1}>
      <PageIntro eyebrow="Hello, neighbour" title="Fresh food. Close to home.">
        Welcome to S & D Fruit and Veg, your neighbourhood fruit and vegetable shop in Lenasia.
      </PageIntro>
      <section className="site-container section-space grid items-center gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl">
          <Image
            src="/images/kitchen.jpg"
            alt="Illustrative stock photograph of ingredients arranged on a kitchen table"
            fill
            sizes="(max-width: 1024px) 90vw, 45vw"
            className="object-cover"
          />
        </div>
        <div>
          <p className="eyebrow">S & D Fruit and Veg</p>
          <h2 className="section-title mt-3">Everyday meals start with the good stuff.</h2>
          <p className="mt-6 leading-8 text-muted-foreground">{store.about}</p>
          <p className="mt-5 leading-8 text-muted-foreground">
            Visit us at {store.address}. Our shop is open Monday to Saturday,
            {store.weekdayOpen}–{store.weekdayClose}, and Sunday, {store.sundayOpen}–
            {store.sundayClose}.
          </p>
          <p className="mt-5 leading-8 text-muted-foreground">
            We’re preparing a new online store with fruit, vegetables and extras, free delivery to
            eligible Lenasia addresses and collection from the shop.
          </p>
          <p className="mt-6 font-heading text-lg font-semibold text-primary">
            Freshness You Can Trust. Quality You Can Taste.
          </p>
          <Button asChild className="mt-8">
            <Link href="/contact">
              Come say hello
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
