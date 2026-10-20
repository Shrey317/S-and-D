import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ShoppingBasket } from 'lucide-react';
import { PageIntro } from '@/components/storefront/page-intro';
import { CatalogCard } from '@/components/storefront/catalog-card';
import { CatalogFilters, CatalogSearch } from '@/components/storefront/catalog-filters';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { parseFilters, catalogUrl } from '@/features/catalog/filters';
import { loadCatalog } from '@/server/catalog/service';
import { RetryCatalog } from '@/components/storefront/retry-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shop fresh produce',
  description:
    'Explore fruit, vegetables and pack sizes from S & D Fruit and Veg in Lenasia. Development samples are not for sale.',
  alternates: { canonical: '/shop' },
};
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const { status, result, categories } = await loadCatalog(filters);
  const category = categories.find((item) => item.slug === filters.category);
  return (
    <main id="main-content" tabIndex={-1}>
      <PageIntro eyebrow="Something for every basket" title={category?.name ?? 'Explore the shop'}>
        Explore our catalog and choose a pack size. Online ordering is coming soon.
      </PageIntro>
      <div className="site-container section-space">
        {status !== 'ready' || !result ? (
          <EmptyState
            icon={<ShoppingBasket />}
            title={
              status === 'disabled'
                ? 'Our online catalog is coming soon'
                : 'The catalog is temporarily unavailable'
            }
            action={<RetryCatalog />}
          >
            {status === 'disabled'
              ? 'Products, prices and availability will appear when the catalog is connected.'
              : 'Please try again shortly, or call the shop for current availability.'}
          </EmptyState>
        ) : (
          <>
            <nav aria-label="Category filters" className="mb-8 flex flex-wrap gap-2">
              <Link
                href={catalogUrl(filters, { category: '', page: 1 })}
                className={buttonVariants({
                  variant: !filters.category ? 'default' : 'outline',
                  size: 'sm',
                })}
              >
                All categories
              </Link>
              {categories.map((item) => (
                <Link
                  key={item.id}
                  href={catalogUrl(filters, { category: item.slug, page: 1 })}
                  aria-current={filters.category === item.slug ? 'page' : undefined}
                  className={buttonVariants({
                    variant: filters.category === item.slug ? 'default' : 'outline',
                    size: 'sm',
                  })}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
            <Suspense>
              <CatalogSearch initialQuery={filters.q} />
            </Suspense>
            <div className="mt-8 grid items-start gap-8 lg:grid-cols-[220px_1fr]">
              <CatalogFilters filters={filters} categories={categories} />
              <section aria-label="Product results" aria-live="polite">
                <p className="mb-5 text-sm text-muted-foreground">
                  {result.total} products · Page {result.page} of {result.pages}
                </p>
                {result.products.length ? (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {result.products.map((product) => (
                      <CatalogCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<ShoppingBasket />}
                    title={
                      filters.selection === 'popular'
                        ? 'Customer favourites are still to come'
                        : 'No products match these filters'
                    }
                    action={
                      <Button asChild variant="outline">
                        <Link href="/shop">Clear filters</Link>
                      </Button>
                    }
                  >
                    {filters.selection === 'popular'
                      ? 'Popular products will be based on real completed sales once ordering launches.'
                      : 'Try a different search, category or price range.'}
                  </EmptyState>
                )}
                {result.pages > 1 ? (
                  <nav
                    aria-label="Catalog pages"
                    className="mt-8 flex items-center justify-between gap-4"
                  >
                    {result.page > 1 ? (
                      <Button asChild variant="outline">
                        <Link href={catalogUrl(filters, { page: result.page - 1 })}>Previous</Link>
                      </Button>
                    ) : (
                      <span />
                    )}
                    <span className="text-sm">
                      {result.page} / {result.pages}
                    </span>
                    {result.page < result.pages ? (
                      <Button asChild variant="outline">
                        <Link href={catalogUrl(filters, { page: result.page + 1 })}>Next</Link>
                      </Button>
                    ) : (
                      <span />
                    )}
                  </nav>
                ) : null}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
