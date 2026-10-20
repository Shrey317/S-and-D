import type { CatalogImage } from './types';

export type ImageRecord = { publicId: string; version: number; format: string; alt: string };
export function catalogImage(
  record: ImageRecord | undefined,
  category: string,
  cloudName?: string,
): CatalogImage {
  if (
    record &&
    cloudName &&
    /^[a-z0-9_-]+$/i.test(cloudName) &&
    /^sd-catalog\/[a-zA-Z0-9/_-]+$/.test(record.publicId) &&
    ['jpg', 'png', 'webp'].includes(record.format) &&
    Number.isSafeInteger(record.version) &&
    record.version > 0
  ) {
    return {
      src: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_1000/v${record.version}/${record.publicId}.${record.format}`,
      alt: record.alt,
      illustrative: false,
    };
  }
  return {
    src:
      category === 'fruits'
        ? '/images/fruit.jpg'
        : category === 'vegetables'
          ? '/images/produce.jpg'
          : '/images/kitchen.jpg',
    alt: 'Illustrative category photograph; product photograph pending',
    illustrative: true,
  };
}
