import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageIntro({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b bg-secondary/45">
      <div className="site-container py-12 sm:py-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Link href="/" className="underline underline-offset-4">
            Home
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span aria-current="page">{title}</span>
        </nav>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-heading text-4xl leading-tight font-extrabold tracking-tight text-primary sm:text-5xl">
          {title}
        </h1>
        <div className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
