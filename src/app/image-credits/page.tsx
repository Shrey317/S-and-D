import type { Metadata } from 'next';
import { PageIntro } from '@/components/storefront/page-intro';

export const metadata: Metadata = { title: 'Photography credits' };

export default function CreditsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageIntro eyebrow="The images in this preview" title="Photography credits">
        Our preview uses licensed illustrative photography. These are not photographs of S & D Fruit
        and Veg, its suppliers or its actual stock.
      </PageIntro>
      <div className="site-container section-space">
        <ul className="max-w-3xl divide-y">
          {[
            {
              name: 'Andres Carreno',
              subject: 'Mixed vegetables at a market',
              url: 'https://unsplash.com/photos/bunch-of-vegetables-RqS7r2CzL68',
            },
            {
              name: 'Randy Fath',
              subject: 'Colourful peppers',
              url: 'https://unsplash.com/photos/assorted-vegetables-ZaLUzigr0mc',
            },
            {
              name: 'engin akyurt',
              subject: 'Apples and leaves',
              url: 'https://unsplash.com/photos/a-pile-of-oranges-and-apples-with-leaves-on-them-vJuGOGSS6kQ',
            },
            {
              name: 'NordWood Themes',
              subject: 'Ingredients on a kitchen table',
              url: 'https://unsplash.com/photos/assorted-vegetables-fruits-and-flowers-on-white-surface--2Xuq0g2U_8',
            },
          ].map((image) => (
            <li key={image.name} className="py-6">
              <h2 className="font-semibold">{image.subject}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Photograph by{' '}
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  {image.name} on Unsplash
                </a>
                .
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted-foreground">
          Used under the{' '}
          <a
            href="https://unsplash.com/license"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            Unsplash License
          </a>
          . Actual shop and product photographs will replace placeholders as approved.
        </p>
      </div>
    </main>
  );
}
