/** Confirmed business facts. Editable database settings replace these defaults in later phases. */
export const business = {
  name: 'S & D Fruit and Veg',
  tagline: 'Freshness You Can Trust. Quality You Can Taste.',
  locale: 'en-ZA',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  phoneDisplay: '083 504 3385',
  phoneInternational: '+27835043385',
  address: '155 Gemsbok Street, Lenasia, 1827, Johannesburg, South Africa',
  vatRegistered: false,
  deliveryFee: '0.00',
  minimumOrder: '0.00',
  orderingCutoff: '19:00',
  sameDayPromisesEnabled: false,
  hours: [
    { days: 'Monday–Saturday', opens: '08:45', closes: '18:00' },
    { days: 'Sunday', opens: '09:00', closes: '16:00' },
  ],
} as const;
