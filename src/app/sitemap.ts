import type { MetadataRoute } from 'next';

// Preview is intentionally not indexable. Populate only as part of an approved launch.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
