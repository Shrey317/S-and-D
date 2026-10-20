'use client';

import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogContent({
  className,
  children,
  variant = 'dialog',
  ...props
}: ComponentProps<typeof Primitive.Content> & { variant?: 'dialog' | 'sheet' }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
      <Primitive.Content
        data-variant={variant}
        className={cn(
          'dialog-content fixed z-50 overflow-y-auto border bg-card p-6 text-card-foreground shadow-2xl sm:p-8',
          variant === 'sheet'
            ? 'inset-y-0 right-0 w-full max-w-md border-y-0 border-r-0'
            : 'top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl',
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          aria-label="Close panel"
          className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return (
    <Primitive.Title
      className={cn('pr-10 font-heading text-2xl font-bold tracking-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description
      className={cn('mt-3 text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}
