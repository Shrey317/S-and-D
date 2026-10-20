import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/** Display contract only. Phase 3 supplies real catalog records and server-formatted prices. */
export type ProductCardData = {
  name: string;
  href: string;
  image: string;
  imageAlt: string;
  category: string;
  priceLabel: string;
  unitLabel: string;
  available: boolean;
  isSample?: boolean;
  illustrative?: boolean;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card">
      <Link href={product.href} className="relative block aspect-square overflow-hidden">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover"
        />
      </Link>
      <div className="p-5">
        {product.isSample ? <Badge className="mb-3">Development sample</Badge> : null}
        <p className="text-xs font-medium text-muted-foreground">{product.category}</p>
        <h3 className="mt-2 text-lg font-bold">
          <Link href={product.href}>{product.name}</Link>
        </h3>
        <p className="mt-3 font-semibold tabular-nums">
          {product.priceLabel}{' '}
          <span className="text-xs font-normal text-muted-foreground">/ {product.unitLabel}</span>
        </p>
        {!product.available ? <Badge className="mt-3">This pack is out of stock</Badge> : null}
        {product.illustrative ? (
          <p className="mt-3 text-xs text-muted-foreground">Illustrative category photo</p>
        ) : null}
        <Button asChild variant="outline" size="sm" className="mt-4 w-full">
          <Link href={product.href}>
            View product
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card p-4">
      <Skeleton className="aspect-square" />
      <Skeleton className="mt-4 h-5 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-5 h-11 rounded-full" />
    </div>
  );
}
