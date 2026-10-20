import { loadCatalog } from '@/server/catalog/service';
import { parseFilters } from '@/features/catalog/filters';
import { CatalogCard } from './catalog-card';
import { SectionHeading } from './section-heading';
import Link from 'next/link';

export async function FeaturedCatalog() {
  const { result, status } = await loadCatalog(parseFilters({ selection: 'featured' }));
  return (
    <section className="site-container section-space">
      <SectionHeading eyebrow="Something to explore" title="Featured products">
        Find a fresh idea for your next basket.
      </SectionHeading>
      {result?.products.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.products.slice(0, 6).map((product) => (
            <CatalogCard product={product} key={product.id} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          {status === 'unavailable'
            ? 'Featured products are temporarily unavailable. Please try the shop again shortly.'
            : 'Featured products will appear when the catalog is ready.'}
        </p>
      )}
      <Link
        href="/shop"
        className="mt-8 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
      >
        Explore the full catalog
      </Link>
    </section>
  );
}
