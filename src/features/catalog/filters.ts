export const PAGE_SIZE = 12;
export const sortOptions = ['name-asc', 'name-desc', 'price-asc', 'price-desc'] as const;
export type CatalogFilters = {
  q: string;
  category: string;
  min: string;
  max: string;
  availability: 'all' | 'in-stock' | 'out-of-stock';
  selection: 'all' | 'featured' | 'popular';
  sort: (typeof sortOptions)[number];
  page: number;
};
type Params = Record<string, string | string[] | undefined>;
const single = (value: Params[string]) => (typeof value === 'string' ? value : '');
export function parseFilters(params: Params): CatalogFilters {
  const money = (value: Params[string]) =>
    /^\d{1,8}(\.\d{1,2})?$/.test(single(value)) ? single(value) : '';
  let min = money(params.min);
  let max = money(params.max);
  if (min && max && Number(min) > Number(max)) [min, max] = [max, min];
  const availability = single(params.availability);
  const selection = single(params.selection);
  const sort = single(params.sort);
  return {
    q: single(params.q).trim().slice(0, 80),
    category: /^[a-z0-9-]{1,80}$/.test(single(params.category)) ? single(params.category) : '',
    min,
    max,
    availability:
      availability === 'in-stock' || availability === 'out-of-stock' ? availability : 'all',
    selection: selection === 'featured' || selection === 'popular' ? selection : 'all',
    sort: sortOptions.includes(sort as CatalogFilters['sort'])
      ? (sort as CatalogFilters['sort'])
      : 'name-asc',
    page: Math.min(1000, Math.max(1, Number.parseInt(single(params.page), 10) || 1)),
  };
}
export function catalogUrl(filters: CatalogFilters, changes: Partial<CatalogFilters> = {}) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (
      value !== '' &&
      value !== 'all' &&
      !(key === 'page' && value === 1) &&
      !(key === 'sort' && value === 'name-asc')
    )
      params.set(key, String(value));
  }
  return '/shop' + (params.size ? '?' + params.toString() : '');
}
