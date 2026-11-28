import 'server-only';
import { cache } from 'react';
import { getDatabase } from '@/server/db/client';
import { business } from '@/config/business';
import { categories as defaults, sortCategories } from '@/config/categories';
export const readStoreCategories = cache(async () => {
  try {
    const db = await getDatabase();
    if (!db) return [...defaults];
    const rows = await db.category.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return sortCategories(rows).map((row) => {
      const image = defaults.find((c) => c.slug === row.slug) || defaults[2];
      return { ...image, ...row, description: row.description || image.description };
    });
  } catch {
    console.error('Store categories unavailable');
    return [...defaults];
  }
});
export const readStore = cache(async () => {
  let configured = null;
  try {
    const db = await getDatabase();
    configured = db ? await db.storeSettings.findUnique({ where: { id: 'store' } }) : null;
  } catch {
    console.error('Store settings unavailable');
  }
  return (
    configured || {
      id: 'store',
      version: 1,
      phone: business.phoneInternational,
      address: business.address,
      weekdayOpen: '08:45',
      weekdayClose: '18:00',
      sundayOpen: '09:00',
      sundayClose: '16:00',
      announcement: 'Free delivery in eligible Lenasia areas',
      about: 'Fresh produce for your everyday shop. Visit S & D Fruit and Veg in Lenasia.',
    }
  );
});
