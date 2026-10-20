import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { assertLocalTarget, loadLocalEnvironment, toolingDatabase } from './database-tools';
import { seedCatalog } from './seed-data';
import { readCatalog, readProduct } from '../src/server/catalog/repository';
import { parseFilters } from '../src/features/catalog/filters';
import { assertStorefrontRole } from '../src/server/db/permissions';
import { uploadCatalogImage, type ImageProvider } from '../src/server/images/upload';

loadLocalEnvironment();
let stage = 'configuration';
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  const readerUrl = process.env.TEST_READER_URL;
  if (!url || !readerUrl) throw new Error('Test database configuration required.');
  assertLocalTarget(url, 'test');
  assertLocalTarget(readerUrl, 'test');
  assert.equal(new URL(url).pathname, '/sd_catalog_test');
  assert.equal(new URL(readerUrl).pathname, '/sd_catalog_test');
  const owner = toolingDatabase(url);
  const reader = toolingDatabase(readerUrl);
  let passed = 0;
  async function check(name: string, fn: () => Promise<void>) {
    stage = name;
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  }
  try {
    stage = 'fresh test schema';
    // This script only resets the commerce schema in the explicitly named LOCAL test database.
    await owner.$executeRawUnsafe('DROP SCHEMA IF EXISTS commerce CASCADE');
    await owner.$executeRawUnsafe('DROP TABLE IF EXISTS public."_prisma_migrations"');
    function migrate() {
      const result = spawnSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        {
          env: { ...process.env, DIRECT_URL: url },
          encoding: 'utf8',
          windowsHide: true,
          timeout: 180000,
        },
      );
      if (result.status !== 0)
        console.error(
          `Migration process exit: ${result.status ?? 'timeout'}. ${(result.stderr || '').replaceAll(url!, '[database]').replaceAll(new URL(url!).password, '[redacted]')}`,
        );
      assert.equal(
        result.status,
        0,
        'Migration failed; run db:migrate with the isolated test target for diagnostics.',
      );
    }
    await check('fresh migration and repeat deployment', async () => {
      migrate();
      migrate();
    });
    await check('runtime credential guard accepts reader and rejects owner', async () => {
      await assertStorefrontRole(reader);
      await assert.rejects(assertStorefrontRole(owner));
    });
    await check('seed requires database marker', async () => {
      await assert.rejects(seedCatalog(owner));
    });
    await owner.developmentMarker.create({
      data: { id: 'local-catalog', purpose: 'isolated development only' },
    });
    await check('idempotent sample seed: 30 products and 60 distinct variants', async () => {
      await seedCatalog(owner);
      await seedCatalog(owner);
      assert.equal(await owner.product.count(), 30);
      assert.equal(await owner.productVariant.count(), 60);
    });
    const apple = (await owner.product.findUnique({
      where: { slug: 'sample-apples' },
      include: { variants: { orderBy: { position: 'asc' } } },
    }))!;
    const first = apple.variants[0]!;
    const second = apple.variants[1]!;
    const options = { allowSamples: true };
    await check('decimal price and stock constraints', async () => {
      await assert.rejects(
        owner.productVariant.update({ where: { id: first.id }, data: { price: '-0.01' } }),
      );
      await assert.rejects(
        owner.inventoryBalance.update({ where: { variantId: first.id }, data: { reserved: 999 } }),
      );
      await assert.rejects(
        owner.inventoryBalance.update({ where: { variantId: first.id }, data: { onHand: -1 } }),
      );
      await assert.rejects(
        owner.productVariant.create({
          data: {
            productId: apple.id,
            sku: first.sku,
            label: 'Duplicate SKU',
            unit: 'PACK',
            price: '1.00',
          },
        }),
      );
    });
    await check('runtime has no mutation, DDL or development-marker privileges', async () => {
      await assert.rejects(
        reader.product.update({ where: { id: apple.id }, data: { name: 'Unauthorized' } }),
      );
      await assert.rejects(reader.product.delete({ where: { id: apple.id } }));
      await assert.rejects(reader.$executeRawUnsafe('CREATE TABLE commerce.unauthorized (id int)'));
      await assert.rejects(reader.developmentMarker.findMany());
    });
    await check('RLS hides draft products and their variants from direct reads', async () => {
      await owner.product.update({ where: { id: apple.id }, data: { state: 'DRAFT' } });
      assert.equal(await reader.product.count({ where: { id: apple.id } }), 0);
      assert.equal(await reader.productVariant.count({ where: { productId: apple.id } }), 0);
      assert.equal(await readProduct(reader, apple.slug, options), null);
      await owner.product.update({ where: { id: apple.id }, data: { state: 'ACTIVE' } });
    });
    await check('RLS hides inactive category descendants and inactive variants', async () => {
      await owner.category.update({ where: { id: apple.categoryId }, data: { active: false } });
      assert.equal(await reader.product.count({ where: { id: apple.id } }), 0);
      assert.equal(await reader.inventoryBalance.count({ where: { variantId: first.id } }), 0);
      await owner.category.update({ where: { id: apple.categoryId }, data: { active: true } });
      await owner.productVariant.update({ where: { id: first.id }, data: { active: false } });
      assert.equal(await reader.productVariant.count({ where: { id: first.id } }), 0);
      await owner.productVariant.update({ where: { id: first.id }, data: { active: true } });
    });
    await check('price and stock filters match the same variant', async () => {
      await owner.inventoryBalance.update({ where: { variantId: first.id }, data: { onHand: 0 } });
      const none = await readCatalog(
        reader,
        parseFilters({ q: 'Apples', max: '6', availability: 'in-stock' }),
        options,
      );
      assert.equal(none.total, 0);
      const available = await readCatalog(
        reader,
        parseFilters({ q: 'Apples', min: '12', max: '13', availability: 'in-stock' }),
        options,
      );
      assert.equal(available.total, 1);
      assert.equal(available.products[0]!.price, '12.50');
      await owner.inventoryBalance.update({ where: { variantId: first.id }, data: { onHand: 10 } });
    });
    await check('search is literal and SQL parameters cannot expand results', async () => {
      for (const q of ["%' OR 1=1 --", '%', '_'])
        assert.equal((await readCatalog(reader, parseFilters({ q }), options)).total, 0);
      assert.equal((await readCatalog(reader, parseFilters({ q: 'aPpLeS' }), options)).total, 2); // Apples and Pineapples.
    });
    await check('pagination is deterministic and out-of-range pages clamp', async () => {
      const a = await readCatalog(reader, parseFilters({}), options);
      const b = await readCatalog(reader, parseFilters({ page: '2' }), options);
      assert.equal(a.total, 30);
      assert.equal(a.products.length, 12);
      assert.equal(a.pages, 3);
      assert.equal(
        a.products.some((item) => b.products.some((other) => other.id === item.id)),
        false,
      );
      assert.equal((await readCatalog(reader, parseFilters({ page: '999' }), options)).page, 3);
    });
    await check('featured, price sorting and sample exclusion use database data', async () => {
      assert.equal(
        (await readCatalog(reader, parseFilters({ selection: 'featured' }), options)).total,
        6,
      );
      assert.equal((await readCatalog(reader, parseFilters({}), { allowSamples: false })).total, 0);
      assert.equal(await readProduct(reader, apple.slug, { allowSamples: false }), null);
      const prices = (
        await readCatalog(reader, parseFilters({ sort: 'price-desc' }), options)
      ).products.map((item) => Number(item.price));
      assert.deepEqual(
        prices,
        [...prices].sort((a, b) => b - a),
      );
    });
    await check('fresh product reads reflect authoritative variant prices', async () => {
      await owner.productVariant.update({ where: { id: second.id }, data: { price: '23.45' } });
      assert.equal(
        (await readProduct(reader, apple.slug, options))?.variants.find((v) => v.id === second.id)
          ?.price,
        '23.45',
      );
      await owner.productVariant.update({ where: { id: second.id }, data: { price: '12.50' } });
    });
    const buffer = await readFile('public/images/fruit.jpg');
    let uploads = 0;
    let removals = 0;
    const provider: ImageProvider = {
      upload: async (_buffer, publicId) => {
        uploads++;
        return {
          publicId,
          assetId: 'test-asset-' + uploads,
          version: 1,
          format: 'jpg',
          width: 1000,
          height: 750,
        };
      },
      remove: async () => {
        removals++;
      },
    };
    const input = {
      productId: apple.id,
      alt: 'Test apples image',
      provenance: 'Automated provider stub, not an actual upload',
    };
    await check('unauthorized upload is denied before contacting provider', async () => {
      await assert.rejects(uploadCatalogImage(reader, provider, buffer, input));
      assert.equal(uploads, 0);
    });
    await check('authorized image metadata persists and RLS follows its product', async () => {
      const image = await uploadCatalogImage(owner, provider, buffer, input);
      assert.equal(uploads, 1);
      assert.equal(
        (await reader.productImage.findUnique({ where: { id: image.id } }))?.alt,
        input.alt,
      );
      await owner.product.update({ where: { id: apple.id }, data: { state: 'DRAFT' } });
      assert.equal(await reader.productImage.findUnique({ where: { id: image.id } }), null);
      await owner.product.update({ where: { id: apple.id }, data: { state: 'ACTIVE' } });
      await owner.productImage.delete({ where: { id: image.id } });
    });
    await check('invalid provider response cleans up only its newly assigned asset', async () => {
      const invalid: ImageProvider = {
        ...provider,
        upload: async (_buffer, publicId) => ({
          publicId,
          assetId: 'bad',
          version: 1,
          format: 'svg',
          width: 20,
          height: 20,
        }),
      };
      await assert.rejects(uploadCatalogImage(owner, invalid, buffer, input));
      assert.equal(removals, 1);
    });
    console.log(
      `${passed} database integration checks passed against real PostgreSQL. Cloudinary network provider was explicitly stubbed.`,
    );
  } finally {
    await Promise.all([owner.$disconnect(), reader.$disconnect()]);
  }
}
main().catch(() => {
  console.error(
    `Database verification failed at: ${stage}. No credentials or driver error details were logged.`,
  );
  process.exitCode = 1;
});
