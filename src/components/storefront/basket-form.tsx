'use client';
import { useActionState } from 'react';
import { basketAction } from '@/server/checkout/actions';
import { initialFormResult } from '@/features/account/validation';
import { Button } from '@/components/ui/button';
export function BasketForm({
  variantId,
  quantity,
  mode = 'add',
  disabled = false,
}: {
  variantId: string;
  quantity: number;
  mode?: 'add' | 'set';
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(basketAction, initialFormResult);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="mode" value={mode} />
      {mode === 'set' && quantity > 0 ? (
        <label className="flex items-center gap-3 text-sm">
          Quantity
          <input
            className="min-h-12 w-20 rounded-lg border bg-card px-3"
            name="quantity"
            type="number"
            min="0"
            max="99"
            defaultValue={quantity}
            required
          />
        </label>
      ) : (
        <input type="hidden" name="quantity" value={quantity} />
      )}
      <Button disabled={disabled || pending} type="submit">
        {pending
          ? 'Please wait…'
          : mode === 'add'
            ? 'Add to basket'
            : quantity === 0
              ? 'Remove'
              : 'Update quantity'}
      </Button>
      <p role={state.status === 'error' ? 'alert' : 'status'} className="text-sm">
        {state.message}
      </p>
    </form>
  );
}
