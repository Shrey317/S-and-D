import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-2xl border border-dashed bg-card px-6 py-10 text-center', className)}
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-secondary text-primary"
      >
        {icon}
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
