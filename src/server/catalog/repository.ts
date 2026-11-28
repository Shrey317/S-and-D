import { sortCategories } from '@/config/categories';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { PAGE_SIZE, type CatalogFilters } from '@/features/catalog/filters';
import { catalogImage } from '@/features/catalog/images';
import type { CatalogCategory, CatalogDetail, CatalogProduct } from '@/features/catalog/types';

type Options = { allowSamples: boolean; cloudName?: string | undefined };
type Row = {
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
};
const likeLiteral = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

export async function readCategories(db: PrismaClient): Promise<CatalogCategory[]> {
  const rows = await db.category.findMany({
    where: { active: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, name: true, description: true },
  });
  return sortCategories(rows);
}

export async function readCatalog(db: PrismaClient, filters: CatalogFilters, options: Options) {
  // All user values are bound parameters. Only fixed, allowlisted SQL determines ordering.
  const order =
    filters.selection === 'popular'
      ? Prisma.sql`popularity.packs DESC, p.id ASC`
      : filters.sort === 'price-asc'
        ? Prisma.sql`chosen.price ASC, p.id ASC`
        : filters.sort === 'price-desc'
          ? Prisma.sql`chosen.price DESC, p.id ASC`
          : filters.sort === 'name-desc'
            ? Prisma.sql`p.name DESC, p.id ASC`
            : Prisma.sql`p.name ASC, p.id ASC`;
  const availability =
    filters.availability === 'in-stock'
      ? Prisma.sql`AND (COALESCE(i."onHand", 0) - COALESCE(i.reserved, 0)) > 0`
      : filters.availability === 'out-of-stock'
        ? Prisma.sql`AND (COALESCE(i."onHand", 0) - COALESCE(i.reserved, 0)) = 0`
        : Prisma.empty;
  const source = Prisma.sql`
    FROM commerce."Product" p
    JOIN commerce."Category" c ON c.id=p."categoryId" AND c.active
    ${filters.selection === 'popular' ? Prisma.sql`JOIN commerce.public_product_popularity() popularity ON popularity."productId"=p.id` : Prisma.empty}
    JOIN LATERAL (
      SELECT v.price, v.label, (COALESCE(i."onHand",0)-COALESCE(i.reserved,0)) > 0 AS available
      FROM commerce."ProductVariant" v LEFT JOIN commerce."InventoryBalance" i ON i."variantId"=v.id
      WHERE v."productId"=p.id AND v.active
      ${filters.min ? Prisma.sql`AND v.price >= ${filters.min}::numeric` : Prisma.empty}
      ${filters.max ? Prisma.sql`AND v.price <= ${filters.max}::numeric` : Prisma.empty}
      ${availability}
      ORDER BY v.price, v.id LIMIT 1
    ) chosen ON true
    WHERE p.state='ACTIVE'
    ${!options.allowSamples ? Prisma.sql`AND NOT p."isSample"` : Prisma.empty}
    ${filters.q ? Prisma.sql`AND (p.name ILIKE ${likeLiteral(filters.q)} OR p.description ILIKE ${likeLiteral(filters.q)})` : Prisma.empty}
    ${filters.category ? Prisma.sql`AND c.slug=${filters.category}` : Prisma.empty}
    ${filters.selection === 'featured' ? Prisma.sql`AND p.featured` : Prisma.empty}
  `;
  // Only aggregate qualifying real sales are exposed to the catalog role.
  return db.$transaction(
    async (tx) => {
      const counts = await tx.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS count ${source}`,
      );
      const total = Number(counts[0]?.count ?? 0);
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = Math.min(filters.page, pages);
      const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
      SELECT p.id, p.slug, p.name, p.description, c.name AS category, c.slug AS "categorySlug",
        chosen.price::text AS price, chosen.label AS "unitLabel", chosen.available, p."isSample", p.featured
      ${source} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`);
      const images = rows.length
        ? await tx.productImage.findMany({
            where: { productId: { in: rows.map((row) => row.id) } },
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
          })
        : [];
      const products: CatalogProduct[] = rows.map((row) => ({
        ...row,
        image: catalogImage(
          images.find((image) => image.productId === row.id),
          row.categorySlug,
          options.cloudName,
        ),
      }));
      return { products, total, page, pages };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function readProduct(
  db: PrismaClient,
  slug: string,
  options: Options,
): Promise<CatalogDetail | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const product = await db.product.findFirst({
    where: {
      slug,
      state: 'ACTIVE',
      category: { active: true },
      ...(!options.allowSamples ? { isSample: false } : {}),
    },
    include: {
      category: true,
      variants: {
        where: { active: true },
        include: { inventory: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      },
      images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!product || product.variants.length === 0) return null;
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    label: variant.label,
    unit: variant.unit,
    price: variant.price.toFixed(2),
    available: (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0),
  }));
  const first = variants[0]!;
  const images = product.images.length
    ? product.images.map((image) => catalogImage(image, product.category.slug, options.cloudName))
    : [catalogImage(undefined, product.category.slug)];
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category.name,
    categorySlug: product.category.slug,
    price: first.price,
    unitLabel: first.label,
    available: variants.some((variant) => variant.available > 0),
    isSample: product.isSample,
    featured: product.featured,
    image: images[0]!,
    images,
    variants,
  };
}
