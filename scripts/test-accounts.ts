import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLocalTarget, loadLocalEnvironment, toolingDatabase } from './database-tools';
import { assertAccountRole } from '../src/server/db/account-permissions';
import { assertStorefrontRole } from '../src/server/db/permissions';
import {
  readAccount,
  saveAddress,
  deleteAddress,
  saveProfile,
  setWishlist,
  withCustomer,
  hasAdministratorGrant,
} from '../src/server/account/repository';
import { consumeAuthLimit } from '../src/server/auth/rate-limit';

loadLocalEnvironment();
let stage = 'configuration';
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  const writerUrl = process.env.TEST_ACCOUNT_DATABASE_URL;
  const readerUrl = process.env.TEST_READER_URL;
  if (!url || !writerUrl || !readerUrl)
    throw new Error('Configure isolated account test database.');
  for (const value of [url, writerUrl, readerUrl]) {
    assertLocalTarget(value, 'test');
    assert.equal(new URL(value).pathname, '/sd_catalog_test');
  }
  const owner = toolingDatabase(url),
    writer = toolingDatabase(writerUrl),
    reader = toolingDatabase(readerUrl);
  const first = randomUUID(),
    second = randomUUID();
  let passed = 0;
  async function check(name: string, action: () => Promise<void>) {
    stage = name;
    await action();
    passed++;
    console.log(`PASS ${name}`);
  }
  try {
    await check('account capability guard rejects owner and catalog reader', async () => {
      await assertAccountRole(writer);
      await assert.rejects(assertAccountRole(owner));
      await assert.rejects(assertAccountRole(reader));
      await assert.rejects(assertStorefrontRole(writer));
    });
    await check('profiles derive ownership from the server identity', async () => {
      await saveProfile(writer, first, {
        name: 'Customer A',
        phone: '',
        role: 'ADMIN',
        id: second,
      });
      await saveProfile(writer, second, { name: 'Customer B', phone: '' });
      assert.equal((await readAccount(writer, first)).profile.name, 'Customer A');
      assert.equal((await readAccount(writer, second)).profile.name, 'Customer B');
    });
    await check(
      'RLS denies reads without transaction identity and hides another customer',
      async () => {
        assert.equal(await writer.customerProfile.count(), 0);
        await withCustomer(writer, first, async (tx) => {
          assert.equal(await tx.customerProfile.count(), 1);
          assert.equal(await tx.customerProfile.findUnique({ where: { id: second } }), null);
          assert.equal(
            (
              await tx.customerProfile.updateMany({
                where: { id: second },
                data: { name: 'Stolen' },
              })
            ).count,
            0,
          );
        });
        assert.equal(await writer.customerProfile.count(), 0);
        await assert.rejects(reader.customerProfile.count());
      },
    );
    const input = {
      label: 'Home',
      recipient: 'Test Customer',
      phone: '0835043385',
      street: '1 Test street',
      suburb: 'Lenasia',
      city: 'Johannesburg',
      postalCode: '1827',
      instructions: '',
      isDefault: true,
    };
    let address = '';
    await check(
      'addresses cannot be read, edited, reassigned or removed across customers',
      async () => {
        address = await saveAddress(writer, first, input);
        assert.equal((await readAccount(writer, second)).addresses.length, 0);
        await assert.rejects(
          saveAddress(writer, second, { ...input, id: address, street: 'Forged street' }),
        );
        await assert.rejects(deleteAddress(writer, second, address));
        await assert.rejects(
          withCustomer(writer, first, (tx) =>
            tx.address.update({ where: { id: address }, data: { customerId: second } }),
          ),
        );
        assert.equal((await readAccount(writer, first)).addresses[0]?.street, input.street);
      },
    );
    await check(
      'concurrent default changes keep one default and deletion picks a successor',
      async () => {
        await Promise.all([
          saveAddress(writer, first, { ...input, label: 'Office' }),
          saveAddress(writer, first, { ...input, label: 'Family' }),
        ]);
        let items = (await readAccount(writer, first)).addresses;
        assert.equal(items.filter((item) => item.isDefault).length, 1);
        await deleteAddress(writer, first, items.find((item) => item.isDefault)!.id);
        items = (await readAccount(writer, first)).addresses;
        assert.equal(items.filter((item) => item.isDefault).length, 1);
      },
    );
    await check('address maximum is enforced under concurrency', async () => {
      await Promise.allSettled(
        Array.from({ length: 15 }, (_, i) =>
          saveAddress(writer, second, { ...input, label: `Test ${i}` }),
        ),
      );
      assert.equal((await readAccount(writer, second)).addresses.length, 10);
    });
    const product = (await owner.product.findUnique({ where: { slug: 'sample-apples' } }))!;
    await check('wishlist is idempotent, owner-scoped and checks product visibility', async () => {
      await Promise.all([
        setWishlist(writer, first, product.id, true, true),
        setWishlist(writer, first, product.id, true, true),
      ]);
      assert.equal((await readAccount(writer, first)).wishlist.length, 1);
      assert.equal((await readAccount(writer, second)).wishlist.length, 0);
      await setWishlist(writer, second, product.id, false, true);
      assert.equal((await readAccount(writer, first)).wishlist.length, 1);
      await assert.rejects(setWishlist(writer, second, product.id, true, false));
      await owner.product.update({ where: { id: product.id }, data: { state: 'DRAFT' } });
      try {
        await assert.rejects(setWishlist(writer, second, product.id, true, true));
      } finally {
        await owner.product.update({ where: { id: product.id }, data: { state: 'ACTIVE' } });
      }
    });
    await check(
      'runtime cannot grant admin, modify catalog, delete profiles or create schema',
      async () => {
        await assert.rejects(
          writer.administratorGrant.create({ data: { customerId: first, reason: 'forged' } }),
        );
        await assert.rejects(
          writer.product.update({ where: { id: product.id }, data: { name: 'Forged' } }),
        );
        await assert.rejects(writer.customerProfile.delete({ where: { id: first } }));
        await assert.rejects(
          writer.$executeRawUnsafe('CREATE TABLE commerce.unauthorized (id int)'),
        );
        assert.equal(await hasAdministratorGrant(writer, first), false);
        await owner.administratorGrant.create({
          data: { customerId: first, reason: 'isolated test only' },
        });
        assert.equal(await hasAdministratorGrant(writer, first), true);
        assert.equal(await hasAdministratorGrant(writer, second), false);
        await owner.administratorGrant.delete({ where: { customerId: first } });
      },
    );
    await check('durable rate limits are atomic across concurrent requests', async () => {
      const outcomes = await Promise.all(
        Array.from({ length: 12 }, () =>
          consumeAuthLimit(writer, 'test-secret', `test:${first}`, 4),
        ),
      );
      assert.equal(outcomes.filter(Boolean).length, 4);
    });
    console.log(`${passed} account database security checks passed.`);
  } finally {
    await owner.administratorGrant.deleteMany({ where: { customerId: { in: [first, second] } } });
    await owner.customerProfile.deleteMany({ where: { id: { in: [first, second] } } });
    await Promise.all([owner.$disconnect(), writer.$disconnect(), reader.$disconnect()]);
  }
}
main().catch((error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error)
    console.error(`Database error code: ${String(error.code)}`);
  console.error(
    `Account database verification failed at: ${stage}. No credentials or customer records logged.`,
  );
  process.exitCode = 1;
});
