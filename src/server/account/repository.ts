import { z } from 'zod';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { addressSchema, profileSchema, type AddressInput } from '@/features/account/validation';

export async function withCustomer<T>(
  db: PrismaClient,
  customerId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  z.uuid().parse(customerId);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.customer_id', ${customerId}, true)`;
    // Serialize this customer's bounded writes, including default-address selection and wishlist cap.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${customerId}, 0))::text`;
    return work(tx);
  });
}
export async function readAccount(db: PrismaClient, customerId: string) {
  return withCustomer(db, customerId, async (tx) => {
    const profile = await tx.customerProfile.upsert({
      where: { id: customerId },
      create: { id: customerId },
      update: {},
    });
    const addresses = await tx.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    const wishlist = await tx.wishlistItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
    });
    return { profile, addresses, wishlist };
  });
}
export async function saveProfile(db: PrismaClient, customerId: string, input: unknown) {
  const data = profileSchema.parse(input);
  return withCustomer(db, customerId, (tx) =>
    tx.customerProfile.upsert({
      where: { id: customerId },
      create: { id: customerId, ...data },
      update: data,
    }),
  );
}
export async function saveAddress(db: PrismaClient, customerId: string, input: AddressInput) {
  const { id, ...data } = addressSchema.parse(input);
  return withCustomer(db, customerId, async (tx) => {
    await tx.customerProfile.upsert({
      where: { id: customerId },
      create: { id: customerId },
      update: {},
    });
    if (id && !(await tx.address.findFirst({ where: { id, customerId } })))
      throw new Error('Address not found.');
    const count = await tx.address.count({ where: { customerId } });
    if (!id && count >= 10) throw new Error('You can save up to 10 addresses.');
    if (count === 0) data.isDefault = true;
    if (data.isDefault)
      await tx.address.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    if (id) {
      await tx.address.updateMany({ where: { id, customerId }, data });
      return id;
    }
    return (await tx.address.create({ data: { ...data, customerId } })).id;
  });
}
export async function deleteAddress(db: PrismaClient, customerId: string, id: string) {
  z.uuid().parse(id);
  return withCustomer(db, customerId, async (tx) => {
    const result = await tx.address.deleteMany({ where: { id, customerId } });
    if (result.count !== 1) throw new Error('Address not found.');
    if (!(await tx.address.count({ where: { customerId, isDefault: true } }))) {
      const first = await tx.address.findFirst({
        where: { customerId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (first)
        await tx.address.updateMany({
          where: { id: first.id, customerId },
          data: { isDefault: true },
        });
    }
  });
}
export async function setWishlist(
  db: PrismaClient,
  customerId: string,
  productId: string,
  saved: boolean,
  allowSamples: boolean,
) {
  z.uuid().parse(productId);
  return withCustomer(db, customerId, async (tx) => {
    if (!saved) {
      await tx.wishlistItem.deleteMany({ where: { customerId, productId } });
      return;
    }
    if (
      !(await tx.product.findFirst({
        where: {
          id: productId,
          state: 'ACTIVE',
          category: { active: true },
          ...(allowSamples ? {} : { isSample: false }),
        },
      }))
    )
      throw new Error('This product is unavailable.');
    await tx.customerProfile.upsert({
      where: { id: customerId },
      create: { id: customerId },
      update: {},
    });
    if (
      await tx.wishlistItem.findUnique({
        where: { customerId_productId: { customerId, productId } },
      })
    )
      return;
    if ((await tx.wishlistItem.count({ where: { customerId } })) >= 100)
      throw new Error('Your wishlist can hold up to 100 products.');
    await tx.wishlistItem.create({ data: { customerId, productId } });
  });
}
export async function hasAdministratorGrant(db: PrismaClient, customerId: string) {
  return withCustomer(db, customerId, async (tx) =>
    Boolean(await tx.administratorGrant.findUnique({ where: { customerId } })),
  );
}
