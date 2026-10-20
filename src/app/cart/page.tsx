import Link from 'next/link';
import { currentBasket } from '@/server/checkout/service';
import { BasketForm } from '@/components/storefront/basket-form';
import { formatRand } from '@/features/catalog/money';
import { Button } from '@/components/ui/button';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your basket' };
export default async function CartPage() {
  const basket = await currentBasket();
  return (
    <main id="main-content" className="site-container py-12 sm:py-16">
      <p className="eyebrow">Fresh picks</p>
      <h1 className="mt-3 text-4xl font-bold">Your basket</h1>
      <p className="mt-4 text-muted-foreground">
        Prices and availability are checked again at checkout. Items in your basket are not
        reserved.
      </p>
      {basket?.notices.map((notice, i) => (
        <p key={i} role="status" className="mt-4 rounded-xl bg-secondary p-4">
          {notice}
        </p>
      ))}
      {!basket?.lines.length ? (
        <div className="my-10 rounded-2xl border p-8">
          <h2 className="text-2xl font-semibold">Your basket is empty</h2>
          <p className="mt-3">Choose your fruit, vegetables and extras to get started.</p>
        </div>
      ) : (
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4">
            {basket.lines.map((line) => (
              <article
                key={line.variantId}
                className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <h2 className="text-xl font-semibold">
                    {line.slug ? <Link href={`/shop/${line.slug}`}>{line.name}</Link> : line.name}
                  </h2>
                  <p className="mt-2">
                    {line.label} · {formatRand(line.price)} each
                  </p>
                  <p className="mt-2 font-semibold">{formatRand(line.total)}</p>
                  {line.quantity > line.available && (
                    <p className="mt-2 text-destructive">
                      Only {line.available} available. Adjust or remove this item.
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <BasketForm variantId={line.variantId} quantity={line.quantity} mode="set" />
                  <BasketForm variantId={line.variantId} quantity={0} mode="set" />
                </div>
              </article>
            ))}
          </div>
          <aside className="grid gap-4 rounded-2xl bg-secondary p-6">
            <h2 className="text-xl font-semibold">Basket summary</h2>
            <p>Subtotal: {formatRand(basket.subtotal)}</p>
            <p>
              Discount: {formatRand(basket.discount)}{' '}
              {basket.promotion && `· ${basket.promotion.name}`}
            </p>
            <p>Eligible delivery / collection: Free</p>
            <p className="text-xl font-bold">Total: {formatRand(basket.total)}</p>
            <p className="text-sm">
              No VAT charged. Promotion availability is checked again at checkout.
            </p>
            <Button asChild>
              <Link href="/checkout">Continue to checkout</Link>
            </Button>
          </aside>
        </div>
      )}
      <Button variant="outline" className="mt-8" asChild>
        <Link href="/shop">Continue shopping</Link>
      </Button>
    </main>
  );
}
