import { ProductCard } from './product-card';
import type { CatalogProduct } from '@/features/catalog/types';
import { formatRand } from '@/features/catalog/money';
export function CatalogCard({ product }: { product: CatalogProduct }) {
  return (
    <ProductCard
      product={{
        name: product.name,
        href: `/shop/${product.slug}`,
        image: product.image.src,
        imageAlt: product.image.alt,
        category: product.category,
        priceLabel: formatRand(product.price),
        unitLabel: product.unitLabel,
        available: product.available,
        isSample: product.isSample,
        illustrative: product.image.illustrative,
      }}
    />
  );
}
