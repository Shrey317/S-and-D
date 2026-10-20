import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
import { loadProduct, loadCatalog } from '@/server/catalog/service';
import { parseFilters } from '@/features/catalog/filters';
import { ProductGallery } from '@/components/storefront/product-gallery';
import { ProductOptions } from '@/components/storefront/product-options';
import { CatalogCard } from '@/components/storefront/catalog-card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { ShoppingBasket } from 'lucide-react';
import { ActionForm } from '@/components/account/action-form';
import { wishlistAction } from '@/server/account/actions';
import { serverEnv } from '@/config/env.server';

export const dynamic = 'force-dynamic';
const productForRequest = cache(loadProduct);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await productForRequest(slug);
  return {
    title: product?.name ?? 'Product',
    description: product?.description ?? 'Browse the S & D catalog.',
    ...(product ? { alternates: { canonical: `/shop/${product.slug}` } } : {}),
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, status } = await productForRequest(slug);
  if (status !== 'ready')
    return (
      <main id="main-content" tabIndex={-1} className="site-container section-space">
        <EmptyState
          icon={<ShoppingBasket />}
          title="Product information is temporarily unavailable"
          action={
            <Button asChild>
              <Link href="/shop">Back to shop</Link>
            </Button>
          }
        >
          Please try again shortly. Online ordering is not yet available.
        </EmptyState>
      </main>
    );
  if (!product) notFound();
  const related = await loadCatalog(parseFilters({ category: product.categorySlug }));
  return (
    <main id="main-content" tabIndex={-1} className="site-container section-space">
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap gap-2 text-sm text-muted-foreground"
      >
        <Link href="/shop" className="underline underline-offset-4">
          Shop
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/shop?category=${product.categorySlug}`}
          className="underline underline-offset-4"
        >
          {product.category}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} />
        <div>
          <p className="eyebrow">{product.category}</p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-primary">
            {product.name}
          </h1>
          {product.isSample ? (
            <Badge className="mt-5">Development sample · Not for sale</Badge>
          ) : null}
          <p className="mt-6 leading-8 text-muted-foreground">{product.description}</p>
          <ProductOptions
            cartEnabled={serverEnv.CART_ENABLED}
            variants={product.variants}
            wishlist={
              <ActionForm
                action={wishlistAction}
                hidden={{ productId: product.id, saved: 'true' }}
                label="Save to wishlist"
              />
            }
          />
        </div>
      </div>
      {related.result?.products.some((item) => item.id !== product.id) ? (
        <section className="mt-20">
          <h2 className="section-title mb-8">More from {product.category.toLowerCase()}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.result.products
              .filter((item) => item.id !== product.id)
              .slice(0, 3)
              .map((item) => (
                <CatalogCard key={item.id} product={item} />
              ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
