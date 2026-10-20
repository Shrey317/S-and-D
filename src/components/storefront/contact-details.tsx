import { Clock3, MapPin, MessageCircle, Phone } from 'lucide-react';
import { readStore } from '@/server/admin/store';
import { displayPhone } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import { CopyAddress } from './copy-address';

export async function ContactDetails() {
  const store = await readStore(),
    hours = [
      { days: 'Monday–Saturday', opens: store.weekdayOpen, closes: store.weekdayClose },
      { days: 'Sunday', opens: store.sundayOpen, closes: store.sundayClose },
    ];
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card p-7 sm:p-10">
        <MapPin className="mb-5 size-7 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <h3 className="text-2xl font-bold">Your local stop for fresh.</h3>
        <address className="mt-4 text-base leading-8 text-muted-foreground not-italic">
          {store.address}
        </address>
        <div className="mt-6">
          <CopyAddress address={store.address} />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Need help finding us? Call the shop for directions.
        </p>
      </div>
      <div className="rounded-2xl bg-secondary p-7 sm:p-10">
        <div className="flex items-center gap-3">
          <Clock3 className="size-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
          <h3 className="text-xl font-bold">Opening hours</h3>
        </div>
        <dl className="mt-6 divide-y divide-border">
          {hours.map((hours) => (
            <div key={hours.days} className="flex flex-wrap justify-between gap-2 py-4 text-sm">
              <dt>{hours.days}</dt>
              <dd className="font-semibold tabular-nums">
                {hours.opens}–{hours.closes}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild>
            <a href={`tel:${store.phone}`}>
              <Phone aria-hidden="true" />
              {displayPhone(store.phone)}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={`https://wa.me/${store.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
