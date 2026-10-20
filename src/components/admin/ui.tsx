import Link from 'next/link';
import type { ReactNode } from 'react';
export function AdminScreen({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="site-container py-10">
      <p className="eyebrow">Store administration</p>
      <h1 className="mt-3 text-3xl font-bold">{title}</h1>
      {description && <p className="mt-4 max-w-3xl text-muted-foreground">{description}</p>}
      <div className="mt-8 grid gap-6">{children}</div>
    </main>
  );
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7">
      <h2 className="mb-5 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
export function Search({ q = '', placeholder = 'Search' }: { q?: string; placeholder?: string }) {
  return (
    <form className="flex flex-wrap items-end gap-3">
      <label className="flex-1">
        {placeholder}
        <input
          className="mt-2 min-h-12 w-full rounded-lg border bg-card px-4"
          name="q"
          defaultValue={q}
          maxLength={100}
        />
      </label>
      <button className="min-h-12 rounded-lg border px-5" type="submit">
        Search
      </button>
    </form>
  );
}
export function Pager({
  path,
  page,
  more,
  q = '',
  filters = {},
}: {
  path: string;
  page: number;
  more: boolean;
  q?: string;
  filters?: Record<string, string>;
}) {
  const href = (n: number) => `${path}?${new URLSearchParams({ ...filters, page: String(n), q })}`;
  return (
    <nav aria-label="Results pages" className="flex gap-5">
      {page > 1 && (
        <Link className="underline" href={href(page - 1)}>
          Previous
        </Link>
      )}
      {more && (
        <Link className="underline" href={href(page + 1)}>
          Next
        </Link>
      )}
    </nav>
  );
}
export function pagination(raw?: string) {
  return /^[1-9]\d{0,3}$/.test(raw || '') ? Number(raw) : 1;
}
export const reasonField = {
  name: 'reason',
  label: 'Reason for this change',
  required: true,
  minLength: 10,
  maxLength: 500,
} as const;
export const options = (values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
