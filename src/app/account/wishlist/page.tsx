import Link from 'next/link';
import { requireIdentity } from '@/server/auth/identity';
import { getAccountDatabase } from '@/server/db/account-client';
import { readAccount } from '@/server/account/repository';
import { wishlistAction } from '@/server/account/actions';
import { ActionForm } from '@/components/account/action-form';
import { serverEnv } from '@/config/env.server';
export default async function WishlistPage() {
  const user = await requireIdentity('/account/wishlist');
  const db = await getAccountDatabase();
  const { wishlist } = await readAccount(db, user.id);
  const products = await db.product.findMany({
    where: {
      id: { in: wishlist.map((item) => item.productId) },
      ...(serverEnv.CATALOG_ALLOW_SAMPLES ? {} : { isSample: false }),
    },
    select: { id: true, name: true, slug: true, isSample: true },
  });
  return (
    <>
      <h1 className="text-3xl font-bold">Your wishlist</h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        Keep your favourites here. Product pages always show current pack prices and availability.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {wishlist.map(({ productId }) => {
          const product = products.find((item) => item.id === productId);
          return (
            <article key={productId} className="rounded-2xl border bg-card p-6">
              <h2 className="text-xl font-semibold">
                {product?.name || 'Product currently unavailable'}
              </h2>
              {product?.isSample ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Development sample · Not for sale
                </p>
              ) : null}
              {product ? (
                <Link className="my-5 inline-block underline" href={`/shop/${product.slug}`}>
                  View product
                </Link>
              ) : (
                <p className="my-5 text-sm text-muted-foreground">
                  This item is no longer in the available catalog.
                </p>
              )}
              <ActionForm
                action={wishlistAction}
                hidden={{ productId, saved: 'false' }}
                label="Remove from wishlist"
              />
            </article>
          );
        })}
      </div>
      {!wishlist.length ? (
        <div className="mt-8 rounded-2xl bg-secondary p-8">
          <h2 className="text-xl font-semibold">Make room for your favourites</h2>
          <p className="mt-3 text-muted-foreground">
            Save products from the shop to find them here.
          </p>
          <Link className="mt-5 inline-block underline" href="/shop">
            Explore the shop
          </Link>
        </div>
      ) : null}
    </>
  );
}
