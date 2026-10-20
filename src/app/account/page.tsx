import Link from 'next/link';
import { requireIdentity } from '@/server/auth/identity';
import { getAccountDatabase } from '@/server/db/account-client';
import { readAccount } from '@/server/account/repository';
export default async function AccountPage() {
  const user = await requireIdentity();
  const { profile, addresses, wishlist } = await readAccount(await getAccountDatabase(), user.id);
  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">
        {profile.name ? `Welcome, ${profile.name}` : 'Welcome to your account'}
      </h1>
      <p className="mt-4 break-all text-muted-foreground">{user.email}</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Link href="/account/addresses" className="rounded-2xl border bg-card p-7">
          <h2 className="text-xl font-semibold">Saved addresses</h2>
          <p className="mt-3 text-muted-foreground">
            {addresses.length} saved · Keep your details ready
          </p>
        </Link>
        <Link href="/account/wishlist" className="rounded-2xl border bg-card p-7">
          <h2 className="text-xl font-semibold">Your wishlist</h2>
          <p className="mt-3 text-muted-foreground">
            {wishlist.length} saved · Your favourites in one place
          </p>
        </Link>
      </div>
      <section className="mt-7 rounded-2xl bg-secondary p-7">
        <h2 className="text-xl font-semibold">Your orders</h2>
        <p className="mt-3 leading-7 text-muted-foreground">
          Review your local test orders and add available items to your basket at current prices. No
          payments or fulfilment are enabled yet.
        </p>
        <Link href="/account/orders" className="mt-4 inline-block underline">
          View order history
        </Link>
      </section>
    </>
  );
}
