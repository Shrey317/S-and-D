import Link from 'next/link';
import { Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="S & D Fruit and Veg home"
      className={cn(
        'inline-flex shrink-0 items-center gap-3',
        inverse ? 'text-white' : 'text-primary',
      )}
    >
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-full border',
          inverse ? 'border-white/30' : 'border-primary/30',
        )}
      >
        <Sprout className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="font-heading text-xl leading-tight font-extrabold tracking-tight">
        S & D
        <span className="block text-[10px] font-semibold tracking-[0.18em] uppercase">
          Fruit and Veg
        </span>
      </span>
    </Link>
  );
}
