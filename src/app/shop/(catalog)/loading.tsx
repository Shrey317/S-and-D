import { ProductCardSkeleton } from '@/components/storefront/product-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ShopLoading() {
  return (
    <main id="main-content" tabIndex={-1} className="site-container section-space">
      <div role="status">
        <span className="sr-only">Loading shop</span>
        <Skeleton className="mb-8 h-12 w-2/3 max-w-md" />
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <ProductCardSkeleton key={key} />
          ))}
        </div>
      </div>
    </main>
  );
}
