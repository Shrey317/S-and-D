'use client';
import { useState } from 'react';
import { BasketForm } from './basket-form';
import { formatRand } from '@/features/catalog/money';
import type { CatalogVariant } from '@/features/catalog/types';
import type { ReactNode } from 'react';

export function ProductOptions({
  variants,
  wishlist,
  cartEnabled = false,
}: {
  variants: CatalogVariant[];
  wishlist?: ReactNode;
  cartEnabled?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(variants[0]!.id);
  const [quantity, setQuantity] = useState(1);
  const variant = variants.find((item) => item.id === selectedId)!;
  return (
    <div>
      <fieldset className="mt-7">
        <legend className="mb-3 text-sm font-semibold">Choose a pack</legend>
        <div className="flex flex-wrap gap-3">
          {variants.map((item) => (
            <label
              key={item.id}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 py-3 has-checked:border-primary has-checked:bg-secondary"
            >
              <input
                type="radio"
                name="variant"
                value={item.id}
                checked={selectedId === item.id}
                onChange={() => {
                  setSelectedId(item.id);
                  setQuantity(1);
                }}
                className="accent-primary"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-7" aria-live="polite" aria-atomic="true">
        <p className="text-3xl font-bold tabular-nums" data-testid="variant-price">
          {formatRand(variant.price)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">per {variant.label} · No VAT charged</p>
        <p className="mt-4 font-semibold">
          {variant.available > 0 ? `${variant.available} packs available` : 'Out of stock'}
        </p>
      </div>
      <div className="mt-6">
        <label htmlFor="product-quantity" className="mb-2 block text-sm font-semibold">
          Quantity
        </label>
        <input
          id="product-quantity"
          type="number"
          min={1}
          max={Math.max(1, variant.available)}
          disabled={variant.available === 0}
          value={quantity}
          onChange={(event) =>
            setQuantity(
              Math.max(
                1,
                Math.min(variant.available || 1, Number.parseInt(event.target.value, 10) || 1),
              ),
            )
          }
          className="min-h-12 w-24 rounded-lg border bg-card px-4"
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <BasketForm
          variantId={variant.id}
          quantity={quantity}
          disabled={!cartEnabled || variant.available === 0}
        />
        {wishlist}
      </div>
      <p id="shopping-status" className="mt-4 text-sm leading-7 text-muted-foreground">
        {cartEnabled
          ? 'Save your selection in a basket. Checkout is a local test preview; no purchase is made.'
          : 'Baskets are currently unavailable. You can still explore products and pack sizes.'}
      </p>
    </div>
  );
}
