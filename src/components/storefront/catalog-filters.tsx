'use client';

import { useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { CatalogFilters as Filters } from '@/features/catalog/filters';
import type { CatalogCategory } from '@/features/catalog/types';

export function CatalogSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousQuery = useRef(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const input = inputRef.current;
    // Sync Back/Forward navigation without overwriting characters typed ahead of a response.
    if (input && (document.activeElement !== input || input.value === previousQuery.current))
      input.value = initialQuery;
    previousQuery.current = initialQuery;
  }, [initialQuery]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function search(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      next.delete('page');
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      startTransition(() => router.replace('/shop?' + next.toString(), { scroll: false }));
    }, 350);
  }
  return (
    <form action="/shop" method="get" className="max-w-lg">
      {[...params.entries()]
        .filter(([key]) => key !== 'q' && key !== 'page')
        .map(([key, value], index) => (
          <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
        ))}
      <label htmlFor="catalog-search" className="mb-2 block text-sm font-semibold">
        Search products
      </label>
      <Input
        id="catalog-search"
        name="q"
        type="search"
        maxLength={80}
        ref={inputRef}
        defaultValue={initialQuery}
        onChange={(event) => search(event.target.value)}
        placeholder="Try apples or tomatoes"
      />
      <span role="status" className="mt-2 block min-h-5 text-xs text-muted-foreground">
        {pending ? 'Updating results…' : 'Results update as you type.'}
      </span>
    </form>
  );
}

function FilterForm({
  filters,
  categories,
  prefix,
}: {
  filters: Filters;
  categories: CatalogCategory[];
  prefix: string;
}) {
  const selectClass = 'min-h-12 w-full rounded-lg border bg-background px-3 text-sm';
  return (
    <form action="/shop" method="get" className="grid gap-5" key={JSON.stringify(filters)}>
      <input type="hidden" name="q" value={filters.q} />
      <div>
        <label htmlFor={`${prefix}-category`} className="mb-2 block text-sm font-semibold">
          Category
        </label>
        <select
          id={`${prefix}-category`}
          name="category"
          defaultValue={filters.category}
          className={selectClass}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Variant price (R)</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${prefix}-min`} className="text-xs">
              Minimum
            </label>
            <Input
              id={`${prefix}-min`}
              name="min"
              type="number"
              min="0"
              max="99999999"
              step="0.01"
              defaultValue={filters.min}
            />
          </div>
          <div>
            <label htmlFor={`${prefix}-max`} className="text-xs">
              Maximum
            </label>
            <Input
              id={`${prefix}-max`}
              name="max"
              type="number"
              min="0"
              max="99999999"
              step="0.01"
              defaultValue={filters.max}
            />
          </div>
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${prefix}-availability`} className="mb-2 block text-sm font-semibold">
          Availability
        </label>
        <select
          id={`${prefix}-availability`}
          name="availability"
          defaultValue={filters.availability}
          className={selectClass}
        >
          <option value="all">All availability</option>
          <option value="in-stock">In stock</option>
          <option value="out-of-stock">Out of stock variants</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-selection`} className="mb-2 block text-sm font-semibold">
          Selection
        </label>
        <select
          id={`${prefix}-selection`}
          name="selection"
          defaultValue={filters.selection}
          className={selectClass}
        >
          <option value="all">All products</option>
          <option value="featured">Featured</option>
          <option value="popular">Popular</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-sort`} className="mb-2 block text-sm font-semibold">
          Sort by
        </label>
        <select
          id={`${prefix}-sort`}
          name="sort"
          defaultValue={filters.sort}
          className={selectClass}
        >
          <option value="name-asc">Name: A–Z</option>
          <option value="name-desc">Name: Z–A</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      <Button type="submit">Apply filters</Button>
      <Button asChild variant="outline">
        <Link href="/shop">Clear filters</Link>
      </Button>
    </form>
  );
}
export function CatalogFilters({
  filters,
  categories,
}: {
  filters: Filters;
  categories: CatalogCategory[];
}) {
  return (
    <>
      <aside className="hidden lg:block" aria-label="Product filters">
        <h2 className="mb-6 text-lg font-bold">Refine your basket</h2>
        <FilterForm filters={filters} categories={categories} prefix="desktop" />
      </aside>
      <div className="lg:hidden">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal aria-hidden="true" />
              Filters & sort
            </Button>
          </DialogTrigger>
          <DialogContent variant="sheet">
            <DialogTitle>Filters & sort</DialogTitle>
            <DialogDescription>Find the category, price and pack that suits you.</DialogDescription>
            <div className="mt-8">
              <FilterForm filters={filters} categories={categories} prefix="mobile" />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
