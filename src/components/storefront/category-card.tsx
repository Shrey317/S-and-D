import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function CategoryCard({
  category,
}: {
  category: { slug: string; name: string; description: string; image: string; alt: string };
}) {
  return (
    <Link
      href={`/shop?category=${category.slug}`}
      className="category-card group block overflow-hidden rounded-2xl border border-border/70 bg-card"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={category.image}
          alt={category.alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
        />
      </div>
      <div className="flex items-center justify-between gap-4 p-6">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">{category.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <ArrowUpRight className="size-5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
