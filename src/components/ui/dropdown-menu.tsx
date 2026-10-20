'use client';

import * as Primitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-[60] min-w-44 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuRadioItem({
  children,
  className,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem
      className={cn(
        'relative flex min-h-11 cursor-default items-center gap-3 rounded-lg py-2 pr-9 pl-3 text-sm outline-none select-none data-highlighted:bg-secondary',
        className,
      )}
      {...props}
    >
      {children}
      <span className="absolute right-3">
        <Primitive.ItemIndicator>
          <Check className="size-4" aria-hidden="true" />
        </Primitive.ItemIndicator>
      </span>
    </Primitive.RadioItem>
  );
}
