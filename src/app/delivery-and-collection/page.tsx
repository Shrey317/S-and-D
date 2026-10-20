import type { Metadata } from 'next';
import { Store, Truck, Clock3 } from 'lucide-react';
import { PageIntro } from '@/components/storefront/page-intro';
import { ContactDetails } from '@/components/storefront/contact-details';
import { readStore } from '@/server/admin/store';

export const metadata: Metadata = { title: 'Delivery and collection' };

export default async function DeliveryPage() {
  const store = await readStore();
  return (
    <main id="main-content" tabIndex={-1}>
      <PageIntro eyebrow="From our shop to you" title="Your basket. Your way.">
        Here’s the confirmed delivery and collection information for our upcoming online store.
        Online ordering is not yet available.
      </PageIntro>
      <div className="site-container section-space">
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border bg-card p-8">
            <Truck className="mb-5 size-8 text-primary" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Free local delivery</h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              Delivery costs R0.00 for eligible addresses within the approved Lenasia service area.
              There is no minimum order amount.
            </p>
            <p className="mt-3 leading-8 text-muted-foreground">
              Address eligibility will be checked before delivery is offered. If your address is
              outside the delivery area, collection is an alternative.
            </p>
          </section>
          <section className="rounded-2xl border bg-card p-8">
            <Store className="mb-5 size-8 text-primary" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Collect from the shop</h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              Collect from {store.address}. We’ll confirm collection arrangements with you once your
              order has been reviewed.
            </p>
            <p className="mt-3 leading-8 text-muted-foreground">
              Collection arrangements must fit the shop’s opening hours. Customers will not need to
              choose a delivery time slot.
            </p>
          </section>
        </div>
        <section className="my-10 rounded-2xl bg-secondary p-8">
          <div className="flex items-center gap-3">
            <Clock3 className="size-6 text-primary" aria-hidden="true" />
            <h2 className="text-xl font-bold">A note on timing</h2>
          </div>
          <p className="mt-4 max-w-3xl leading-8 text-muted-foreground">
            Checkout shows the current ordering cutoff in South African Standard Time. It is
            separate from shop closing times and does not promise delivery until that hour. Same-day
            delivery is not guaranteed; fulfilment depends on availability and will be confirmed.
          </p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            The final same-day rules, exact service boundaries and complete delivery policy will be
            confirmed before online ordering launches.
          </p>
        </section>
        <ContactDetails />
      </div>
    </main>
  );
}
