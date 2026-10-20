import { describe, expect, it } from 'vitest';
import { parseFilters, catalogUrl } from '@/features/catalog/filters';
import { formatRand } from '@/features/catalog/money';
import { catalogImage } from '@/features/catalog/images';
import { validateImageBytes } from '@/server/images/upload';
import { assertLocalTarget } from '../../scripts/database-tools';
import { parseServerEnv } from '@/config/env.schema';

describe('catalog boundaries', () => {
  it('blocks sample mode in production and hosted previews', () => {
    for (const APP_ENV of ['production', 'preview'])
      expect(() =>
        parseServerEnv({
          APP_ENV,
          NEXT_PUBLIC_SITE_URL: 'https://example.com',
          CATALOG_ALLOW_SAMPLES: 'true',
        }),
      ).toThrow(/CATALOG_ALLOW_SAMPLES/);
  });
  it('bounds hostile/repeated input and normalizes reversed prices', () => {
    expect(
      parseFilters({
        page: '-3',
        q: ' x '.repeat(80),
        sort: 'price;DROP',
        category: ['fruits', 'extra'],
        min: '20',
        max: '5',
        availability: 'bad',
      }),
    ).toMatchObject({
      page: 1,
      sort: 'name-asc',
      category: '',
      min: '5',
      max: '20',
      availability: 'all',
    });
    expect(parseFilters({ q: 'x'.repeat(100) }).q).toHaveLength(80);
    expect(parseFilters({ min: 'NaN', max: '1e8', page: '999999' })).toMatchObject({
      min: '',
      max: '',
      page: 1000,
    });
  });
  it('retains filters when paginating with correct URL encoding', () => {
    const url = catalogUrl(parseFilters({ q: 'apples & pears', category: 'fruits' }), { page: 2 });
    expect(new URL(url, 'http://localhost').searchParams.get('q')).toBe('apples & pears');
    expect(url).toContain('page=2');
  });
  it('formats decimal text without floating-point arithmetic', () => {
    expect(formatRand('123456789.1')).toBe('R123 456 789.10');
    expect(formatRand('0')).toBe('R0.00');
    expect(() => formatRand('-1')).toThrow();
  });
  it('never accepts arbitrary image hosts, unsafe paths or SVG', () => {
    expect(
      catalogImage(
        { publicId: '../evil', version: 1, format: 'jpg', alt: 'x' },
        'fruits',
        'mycloud',
      ).illustrative,
    ).toBe(true);
    expect(
      catalogImage(
        { publicId: 'sd-catalog/a/b', version: 2, format: 'webp', alt: 'x' },
        'fruits',
        'mycloud',
      ).src,
    ).toBe(
      'https://res.cloudinary.com/mycloud/image/upload/f_auto,q_auto,w_1000/v2/sd-catalog/a/b.webp',
    );
  });
  it('rejects disguised or oversized image files', () => {
    expect(() => validateImageBytes(Buffer.from('<svg>not permitted</svg>'))).toThrow();
    expect(() => validateImageBytes(Buffer.alloc(5 * 1024 * 1024 + 1))).toThrow();
  });
  it('refuses seed/test tooling on remote, production and unrelated databases', () => {
    for (const [url, environment] of [
      ['postgresql://localhost/production', 'development'],
      ['postgresql://example.com/sd_catalog_dev', 'development'],
      ['postgresql://localhost/sd_catalog_dev', 'production'],
    ])
      expect(() => assertLocalTarget(url!, environment)).toThrow();
  });
});
