export type CatalogImage = { src: string; alt: string; illustrative: boolean };
export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  categorySlug: string;
  price: string;
  unitLabel: string;
  available: boolean;
  isSample: boolean;
  featured: boolean;
  image: CatalogImage;
};
export type CatalogVariant = {
  id: string;
  sku: string;
  label: string;
  unit: string;
  price: string;
  available: number;
};
export type CatalogDetail = CatalogProduct & { variants: CatalogVariant[]; images: CatalogImage[] };
export type CatalogCategory = { id: string; slug: string; name: string; description: string };
