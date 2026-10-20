import type { PrismaClient } from '../src/generated/prisma/client';

const samples = {
  fruits: [
    'Apples',
    'Bananas',
    'Oranges',
    'Pears',
    'Grapes',
    'Lemons',
    'Peaches',
    'Plums',
    'Mangoes',
    'Pineapples',
  ],
  vegetables: [
    'Tomatoes',
    'Potatoes',
    'Onions',
    'Carrots',
    'Cabbage',
    'Spinach',
    'Peppers',
    'Cucumber',
    'Butternut',
    'Broccoli',
  ],
  extra: [
    'Ginger',
    'Garlic',
    'Coriander',
    'Parsley',
    'Mint',
    'Chillies',
    'Basil',
    'Rosemary',
    'Thyme',
    'Spring onions',
  ],
};

export async function seedCatalog(db: PrismaClient) {
  const marker = await db.developmentMarker.findUnique({ where: { id: 'local-catalog' } });
  if (!marker)
    throw new Error(
      'Development database marker missing; run the explicit local bootstrap after migrations.',
    );
  // Idempotent, additive, and atomic. Never resets edited stock/prices or deletes existing records.
  await db.$transaction(
    async (tx) => {
      for (const [position, [slug, names]] of Object.entries(samples).entries()) {
        const category = await tx.category.upsert({
          where: { slug },
          update: {},
          create: {
            slug,
            name: slug === 'fruits' ? 'Fruits' : slug === 'vegetables' ? 'Vegetables' : 'Extra',
            description: 'Browse our ' + slug + ' category.',
            position,
          },
        });
        for (const [index, name] of names.entries()) {
          const productSlug = 'sample-' + name.toLowerCase().replaceAll(' ', '-');
          if (await tx.product.findUnique({ where: { slug: productSlug } })) continue;
          await tx.product.create({
            data: {
              categoryId: category.id,
              slug: productSlug,
              name,
              state: 'ACTIVE',
              isSample: true,
              featured: index < 2,
              description: `Development sample for ${name.toLowerCase()}. The listed prices, pack sizes and stock are fictitious test data, not an offer for sale. Category photography is illustrative.`,
              variants: {
                create: [0, 1].map((size) => ({
                  sku: `DEV-${slug.toUpperCase()}-${index + 1}-${size + 1}`,
                  label: size === 0 ? '500 g pack' : '1 kg pack',
                  unit: 'PACK' as const,
                  price: `${(index + 1) * 5 + size * 7}.50`,
                  position: size,
                  inventory: { create: { onHand: index === 9 ? 0 : 10 + index, reserved: 0 } },
                })),
              },
            },
          });
        }
      }
    },
    { timeout: 20000 },
  );
}
