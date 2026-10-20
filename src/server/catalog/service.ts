import 'server-only';
import { getDatabase } from '@/server/db/client';
import { serverEnv } from '@/config/env.server';
import { readCatalog, readCategories, readProduct } from './repository';
import type { CatalogFilters } from '@/features/catalog/filters';

const options = {
  allowSamples: serverEnv.CATALOG_ALLOW_SAMPLES,
  cloudName: serverEnv.CLOUDINARY_CLOUD_NAME,
};
export async function loadCatalog(filters: CatalogFilters) {
  try {
    const db = await getDatabase();
    if (!db) return { status: 'disabled' as const, result: null, categories: [] };
    const [result, categories] = await Promise.all([
      readCatalog(db, filters, options),
      readCategories(db),
    ]);
    return { status: 'ready' as const, result, categories };
  } catch {
    // Never serialize driver errors, SQL parameters or connection strings to visitors/logs.
    console.error('Catalog read unavailable');
    return { status: 'unavailable' as const, result: null, categories: [] };
  }
}
export async function loadProduct(slug: string) {
  try {
    const db = await getDatabase();
    if (!db) return { status: 'disabled' as const, product: null };
    return { status: 'ready' as const, product: await readProduct(db, slug, options) };
  } catch {
    console.error('Product read unavailable');
    return { status: 'unavailable' as const, product: null };
  }
}
