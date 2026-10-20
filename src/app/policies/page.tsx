import type { Metadata } from 'next';
import { PageIntro } from '@/components/storefront/page-intro';

export const metadata: Metadata = { title: 'Store policies' };

export default function PoliciesPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageIntro eyebrow="Clear information, before you order" title="Our store policies">
        We’re preparing the policies for our online store. They will be reviewed and published
        before online ordering opens.
      </PageIntro>
      <div className="site-container section-space">
        <div className="max-w-3xl space-y-4">
          {[
            'Privacy Policy',
            'Terms and Conditions',
            'Delivery and Collection Policy',
            'Returns and Refunds Policy',
            'Cancellation Policy',
          ].map((policy) => (
            <section
              key={policy}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-6"
            >
              <h2 className="text-base font-semibold">{policy}</h2>
              <span className="text-xs text-muted-foreground">Awaiting review and publication</span>
            </section>
          ))}
          <p className="pt-5 text-sm leading-7 text-muted-foreground">
            This is a development preview. Local accounts and clearly labelled test orders are
            available for testing; genuine purchases and live payments are disabled. Do not enter
            sensitive or real customer information during testing. Final business policies and
            commercial terms require review before launch.
          </p>
        </div>
      </div>
    </main>
  );
}
