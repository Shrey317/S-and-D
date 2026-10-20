import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/storefront/page-intro';
import { ContactDetails } from '@/components/storefront/contact-details';
import { EnquiryForm } from '@/components/storefront/enquiry-form';
import { readStore } from '@/server/admin/store';

export const metadata: Metadata = { title: 'Contact and opening hours' };

export default async function ContactPage() {
  const store = await readStore();
  return (
    <main id="main-content" tabIndex={-1}>
      <PageIntro eyebrow="Let’s talk fresh" title="Come say hello.">
        Visit the shop, give us a call or start a conversation on WhatsApp. We’re right here in
        Lenasia.
      </PageIntro>
      <div className="site-container section-space">
        <ContactDetails />
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-2">
          <EnquiryForm phone={store.phone} />
          <div className="py-4">
            <p className="eyebrow">Before you get in touch</p>
            <h2 className="section-title mt-3">A few helpful details.</h2>
            <div className="mt-8 space-y-5">
              {[
                {
                  question: 'Can I place an order online?',
                  answer:
                    'Not yet. Our online store is in preparation. Please call or WhatsApp the shop to ask about current products and availability.',
                },
                {
                  question: 'Where will you deliver?',
                  answer:
                    'Delivery will be free for approved addresses within Lenasia. Collection from the shop will also be available.',
                },
                {
                  question: 'Is same-day delivery guaranteed?',
                  answer:
                    'No. Fulfilment depends on operating hours and availability. We will confirm the details of an accepted order.',
                },
              ].map((item) => (
                <details key={item.question} className="rounded-xl border p-5">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
            <Link
              href="/delivery-and-collection"
              className="mt-6 inline-block min-h-11 py-3 text-sm font-semibold text-primary underline underline-offset-4"
            >
              Delivery & collection information
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
