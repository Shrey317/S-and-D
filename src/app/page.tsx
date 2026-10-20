import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Leaf, MapPin, ShoppingBasket, Store, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeaturedCatalog } from '@/components/storefront/featured-catalog';
import { CategoryCard } from '@/components/storefront/category-card';
import { ContactDetails } from '@/components/storefront/contact-details';
import { Reveal } from '@/components/storefront/reveal';
import { SectionHeading } from '@/components/storefront/section-heading';
import { readStore, readStoreCategories } from '@/server/admin/store';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [store, categories] = await Promise.all([readStore(), readStoreCategories()]);
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero-section relative overflow-hidden">
        <div className="site-container grid items-center gap-10 py-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-18">
          <Reveal className="relative z-10">
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-7 bg-accent" />
              Your neighbourhood fruit & veg shop
            </p>
            <h1 className="hero-title mt-6">
              Freshness you
              <br />
              can{' '}
              <span className="relative inline-block">
                trust.
                <svg
                  viewBox="0 0 240 16"
                  className="absolute -bottom-2 left-0 w-full text-accent"
                  aria-hidden="true"
                >
                  <path
                    d="M3 10C60 0 160 0 236 9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="mt-8 font-heading text-xl font-semibold text-primary">
              Quality you can taste.
            </p>
            <p className="mt-3 max-w-md text-base leading-8 text-muted-foreground">
              Bring a little more colour to your table. Fruit, vegetables and everyday extras, right
              here in Lenasia.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/shop">
                  Shop Fresh Produce
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#categories">Explore Categories</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Explore the preview. Online ordering is coming soon.
            </p>
            <div className="mt-9 inline-flex items-center gap-2 border-t border-border pt-5 text-xs font-medium text-muted-foreground">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              {store.address}
            </div>
          </Reveal>
          <div className="relative mx-auto w-full max-w-xl pb-5 lg:pb-0">
            <div className="hero-image relative aspect-[1.08] overflow-hidden rounded-t-[42%] rounded-b-[2rem] bg-secondary">
              <Image
                src="/images/market.jpg"
                alt="Illustrative photograph of colourful vegetables at a produce market"
                fill
                preload
                sizes="(max-width: 1024px) 90vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
              <span className="absolute right-5 bottom-24 rounded-full bg-black/70 px-3 py-1 text-[10px] tracking-wide text-white lg:bottom-5">
                Illustrative produce photography
              </span>
            </div>
            <div className="hero-stamp absolute top-6 right-0 flex size-25 rotate-12 flex-col items-center justify-center rounded-full border-4 border-background bg-accent text-center font-heading text-[10px] leading-4 font-bold text-accent-foreground shadow-sm sm:-right-3">
              <Leaf className="mb-1 size-5" strokeWidth={1.5} aria-hidden="true" />
              FRESH FINDS
              <br />
              CLOSE TO HOME
            </div>
            <div className="absolute bottom-0 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-lg sm:-left-5 sm:max-w-none sm:gap-4 sm:px-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <ShoppingBasket className="size-6" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="text-sm font-bold">
                A basket of possibilities.
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  From our neighbourhood to your table.
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className="border-y border-border/70 bg-card">
        <div className="site-container grid gap-6 py-7 sm:grid-cols-3">
          <div className="benefit-item">
            <Truck aria-hidden="true" />
            <div>
              <h2>Free local delivery</h2>
              <p>Eligible Lenasia addresses</p>
            </div>
          </div>
          <div className="benefit-item">
            <Store aria-hidden="true" />
            <div>
              <h2>Collect from the shop</h2>
              <p>{store.address.split(',')[0]}</p>
            </div>
          </div>
          <div className="benefit-item">
            <ShoppingBasket aria-hidden="true" />
            <div>
              <h2>A little or a lot</h2>
              <p>No minimum order amount</p>
            </div>
          </div>
        </div>
      </div>
      <section id="categories" className="site-container section-space scroll-mt-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Something for every basket" title="What’s on your list?">
              From a fruit bowl refresh to tonight’s dinner, start with the good stuff.
            </SectionHeading>
            <Link
              href="/shop"
              className="mb-9 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
            >
              Explore the shop
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard key={category.slug} category={category} />
            ))}
          </div>
        </Reveal>
      </section>
      <FeaturedCatalog />
      <section className="bg-secondary/60">
        <div className="site-container py-10">
          <h2 className="text-xl font-bold">Popular products</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Customer favourites will be based on real completed sales once online ordering launches.
          </p>
        </div>
      </section>
      <section className="site-container section-space">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-18">
            <div className="relative aspect-[1.15] overflow-hidden rounded-2xl">
              <Image
                src="/images/fruit.jpg"
                alt="Illustrative photograph of apples with leaves"
                fill
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover"
              />
              <span className="absolute bottom-4 left-4 rounded-full bg-card/95 px-4 py-2 text-xs font-medium text-foreground">
                A little colour. A lot to enjoy.
              </span>
            </div>
            <div>
              <SectionHeading eyebrow="Why choose S & D" title="Good food. A familiar place.">
                The simple pleasure of shopping close to home. Find your fruit, vegetables and
                everyday extras at our Lenasia shop.
              </SectionHeading>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">Right here in your neighbourhood</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Find us on Gemsbok Street, with opening hours every day of the week.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Truck className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">A convenient way to shop</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Free eligible local delivery or collection, with no minimum order.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Leaf className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">Freshness at the heart of it</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Fruit and vegetables for everyday meals, shared tables and everything in
                      between.
                    </p>
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" className="mt-8">
                <Link href="/about">
                  A little about us
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
      <section className="brand-panel">
        <div className="site-container section-space">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">
                Simple from the start
              </p>
              <h2 className="section-title mt-3 text-white">Fresh shopping, in three steps.</h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-white/75">
              Here’s how ordering will work when our online store launches.
            </p>
          </div>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              {
                title: 'Pick your favourites',
                text: 'Browse the range and choose the products and sizes that suit you.',
              },
              {
                title: 'Choose how to get them',
                text: 'Select free eligible Lenasia delivery or collection from the shop.',
              },
              {
                title: 'We’ll confirm the details',
                text: 'Receive your order confirmation and an update on fulfilment.',
              },
            ].map((step, index) => (
              <li key={step.title} className="border-t border-white/25 pt-6">
                <span className="font-heading text-sm text-accent">0{index + 1}</span>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-7 text-white/75">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 border-t border-white/15 pt-6 text-xs leading-6 text-white/70">
            Delivery dates depend on availability and will be confirmed. Same-day delivery is not
            guaranteed.{' '}
            <Link href="/delivery-and-collection" className="underline underline-offset-4">
              Read delivery information
            </Link>
          </p>
        </div>
      </section>
      <section className="site-container section-space">
        <SectionHeading
          eyebrow="Visit the neighbourhood shop"
          title="Fresh finds. Friendly hellos."
        >
          We’d love to see you on Gemsbok Street. Pop in during our opening hours or get in touch.
        </SectionHeading>
        <ContactDetails />
      </section>
    </main>
  );
}
