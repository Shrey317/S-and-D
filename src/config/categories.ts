/** Category navigation, not a product catalog. Products will come from PostgreSQL in Phase 3. */
export const categories = [
  {
    slug: 'fruits',
    name: 'Fruits',
    description: 'A colourful start to your day.',
    image: '/images/fruit.jpg',
    alt: 'Illustrative stock photograph of apples with green leaves',
    tone: 'fruit',
  },
  {
    slug: 'vegetables',
    name: 'Vegetables',
    description: 'Good things for everyday cooking.',
    image: '/images/produce.jpg',
    alt: 'Illustrative stock photograph of colourful peppers',
    tone: 'vegetable',
  },
  {
    slug: 'extra',
    name: 'Extra',
    description: 'A little more for your kitchen.',
    image: '/images/kitchen.jpg',
    alt: 'Illustrative stock photograph of fruit, onions and walnuts',
    tone: 'extra',
  },
] as const;

type NamedCategory = { name: string; slug: string };

function categoryRank(value: string) {
  switch (value.trim().toLowerCase().replace(/^fresh[ -]+/, '')) {
    case 'fruit':
    case 'fruits':
      return 0;
    case 'vegetable':
    case 'vegetables':
      return 1;
    case 'extra':
    case 'extras':
      return 2;
    default:
      return 3;
  }
}

export function sortCategories<T extends NamedCategory>(rows: readonly T[]): T[] {
  const rank = (row: T) => Math.min(categoryRank(row.slug), categoryRank(row.name));
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en'));
}
