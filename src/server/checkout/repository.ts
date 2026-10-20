import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { compatibleMethod, holdMinutes, isOnline } from '@/features/payments/methods';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { checkoutOffer } from '@/server/admin/checkout-offers';
import {
  checkoutSchema,
  CheckoutError,
  cents,
  decimal,
  firstPlanningDate,
  type CheckoutInput,
} from '@/features/checkout/rules';

export type Owner = { customerId?: string; guestHash?: string };
type Tx = Prisma.TransactionClient;
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function addressHash(address: {
  recipient: string;
  phone: string;
  street: string;
  suburb: string;
  city: string;
  postalCode: string;
  instructions: string;
}) {
  return hash(
    JSON.stringify([
      address.recipient,
      address.phone,
      address.street,
      address.suburb,
      address.city,
      address.postalCode,
      address.instructions,
    ]),
  );
}
export type Line = {
  variantId: string;
  quantity: number;
  name: string;
  label: string;
  unit: string;
  sku: string;
  slug: string;
  price: string;
  total: string;
  available: number;
};
export type Snapshot = {
  lines: Line[];
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  name: string;
  phone: string;
  email: string;
  address: Record<string, string> | null;
  planningDate: string;
  settingsVersion: number;
  policyVersion: string;
  acceptedAt: string;
  isTest: true;
  paymentMethod?: string;
  promotion?: { id: string; name: string; discount: string } | null;
};

export async function withOwner<T>(db: PrismaClient, owner: Owner, work: (tx: Tx) => Promise<T>) {
  if (owner.customerId) z.uuid().parse(owner.customerId);
  if (owner.guestHash)
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(owner.guestHash);
  if (!owner.customerId && !owner.guestHash) throw new CheckoutError('Start a basket first.');
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.customer_id', ${owner.customerId || ''}, true), set_config('app.guest_hash', ${owner.guestHash || ''}, true)`;
      // Consistent advisory order prevents competing guest/customer merges from duplicating items.
      for (const key of [owner.customerId, owner.guestHash]
        .filter((v): v is string => Boolean(v))
        .sort())
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      return work(tx);
    },
    { timeout: 15000, maxWait: 10000 },
  );
}

async function activeCart(tx: Tx, owner: Owner, create: boolean) {
  const where = owner.customerId
    ? { customerId: owner.customerId }
    : { guestHash: owner.guestHash! };
  let cart = await tx.cart.findUnique({ where, include: { lines: true } });
  const notices: string[] = [];
  if (cart?.consumed && !owner.customerId) return { cart: null, notices };
  if (cart && cart.expiresAt <= new Date()) {
    await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
    cart = await tx.cart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 }, expiresAt: new Date(Date.now() + 30 * 86400000) },
      include: { lines: true },
    });
    notices.push('Your old basket expired after 30 days. Start a fresh basket.');
  }
  if (!cart && create)
    cart = await tx.cart.create({
      data: { ...where, expiresAt: new Date(Date.now() + 30 * 86400000) },
      include: { lines: true },
    });
  if (cart && owner.customerId && owner.guestHash) {
    const guest = await tx.cart.findUnique({
      where: { guestHash: owner.guestHash },
      include: { lines: true },
    });
    if (guest && !guest.consumed) {
      if (guest.expiresAt > new Date()) {
        const quantities = new Map(cart.lines.map((line) => [line.variantId, line.quantity]));
        for (const line of guest.lines) {
          if (!quantities.has(line.variantId) && quantities.size >= 50) {
            notices.push('Basket limit reached; an item could not be merged.');
            continue;
          }
          const combined = (quantities.get(line.variantId) || 0) + line.quantity;
          if (combined > 99) notices.push('A merged quantity was limited to 99 packs.');
          quantities.set(line.variantId, Math.min(99, combined));
        }
        await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
        if (quantities.size)
          await tx.cartLine.createMany({
            data: [...quantities].map(([variantId, quantity]) => ({
              cartId: cart!.id,
              variantId,
              quantity,
            })),
          });
        notices.push(
          'Your guest basket has been combined with your account basket. Review quantities and availability.',
        );
      }
      await tx.cart.update({ where: { id: guest.id }, data: { consumed: true } });
      await tx.cartLine.deleteMany({ where: { cartId: guest.id } });
      cart = await tx.cart.update({
        where: { id: cart.id },
        data: { version: { increment: 1 } },
        include: { lines: true },
      });
    }
  }
  return { cart, notices };
}

async function quote(
  tx: Tx,
  cart: Awaited<ReturnType<typeof activeCart>>['cart'],
  allowSamples: boolean,
  promotionCode = '',
  lockOffers = false,
) {
  const lines: Line[] = [];
  const variants = await tx.productVariant.findMany({
    where: {
      id: { in: (cart?.lines || []).map((item) => item.variantId) },
      active: true,
      product: {
        state: 'ACTIVE',
        category: { active: true },
        ...(allowSamples ? {} : { isSample: false }),
      },
    },
    include: { product: true, inventory: true },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  for (const item of [...(cart?.lines || [])].sort((a, b) =>
    a.variantId.localeCompare(b.variantId),
  )) {
    const variant = byId.get(item.variantId);
    if (!variant) {
      lines.push({
        variantId: item.variantId,
        quantity: item.quantity,
        name: 'Unavailable product',
        label: 'Remove this item',
        unit: '',
        sku: '',
        slug: '',
        price: '0.00',
        total: '0.00',
        available: 0,
      });
      continue;
    }
    const price = variant.price.toFixed(2);
    lines.push({
      variantId: variant.id,
      quantity: item.quantity,
      name: variant.product.name,
      label: variant.label,
      unit: variant.unit,
      sku: variant.sku,
      slug: variant.product.slug,
      price,
      total: decimal(cents(price) * BigInt(item.quantity)),
      available: Math.max(0, (variant.inventory?.onHand || 0) - (variant.inventory?.reserved || 0)),
    });
  }
  const subtotal = decimal(lines.reduce((sum, line) => sum + cents(line.total), 0n));
  const offer = await checkoutOffer(
    tx,
    lines.map((l) => ({ ...l, productId: byId.get(l.variantId)?.productId || '' })),
    promotionCode,
    lockOffers,
  );
  const discount = offer.promotion?.discount || '0.00',
    total = decimal(cents(subtotal) - cents(discount));
  const settings = await tx.checkoutSettings.findUniqueOrThrow({ where: { id: 'store' } });
  const store = await tx.storeSettings.findUniqueOrThrow({ where: { id: 'store' } });
  let date = firstPlanningDate(new Date(), settings, store);
  if (settings.dailyCapacity > 0) {
    for (let days = 0; days < 366; days++) {
      const [load] = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT commerce.planning_load(${date}) AS count`;
      if (!settings.closedDates.includes(date) && (load?.count || 0n) < settings.dailyCapacity)
        break;
      if (days === 365) throw new CheckoutError('Fulfilment capacity is unavailable.');
      date = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000)
        .toISOString()
        .slice(0, 10);
    }
  }
  const digest = hash(
    JSON.stringify({
      cart: cart?.id,
      version: cart?.version,
      lines: lines.map(({ variantId, quantity, price, label, unit, sku }) => ({
        variantId,
        quantity,
        price,
        label,
        unit,
        sku,
      })),
      settings: settings.version,
      date,
      promotion: offer.promotion,
    }),
  );
  return {
    lines,
    subtotal,
    discount,
    total,
    ...offer,
    promotionCode,
    quote: digest,
    settings,
    planningDate: date,
  };
}

export async function readBasket(
  db: PrismaClient,
  owner: Owner,
  allowSamples: boolean,
  promotionCode = '',
) {
  return withOwner(db, owner, async (tx) => {
    const { cart, notices } = await activeCart(tx, owner, Boolean(owner.customerId));
    return {
      ...(await quote(tx, cart, allowSamples, promotionCode)),
      notices,
      guestConsumed: !owner.customerId && !cart,
    };
  });
}
export async function changeBasket(
  db: PrismaClient,
  owner: Owner,
  variantId: string,
  quantity: number,
  mode: 'add' | 'set',
  allowSamples: boolean,
) {
  z.uuid().parse(variantId);
  z.number().int().min(0).max(99).parse(quantity);
  return withOwner(db, owner, async (tx) => {
    const { cart, notices } = await activeCart(tx, owner, true);
    if (!cart) throw new CheckoutError('This guest basket has expired. Please try again.');
    const old = cart.lines.find((line) => line.variantId === variantId)?.quantity || 0;
    const next = mode === 'add' ? old + quantity : quantity;
    if (next > 99) throw new CheckoutError('Choose at most 99 packs per item.');
    if (!old && next && cart.lines.length >= 50)
      throw new CheckoutError('Your basket can hold up to 50 items.');
    if (next) {
      const v = await tx.productVariant.findFirst({
        where: {
          id: variantId,
          active: true,
          product: {
            state: 'ACTIVE',
            category: { active: true },
            ...(allowSamples ? {} : { isSample: false }),
          },
        },
        include: { inventory: true },
      });
      if (!v || !v.inventory || next > v.inventory.onHand - v.inventory.reserved)
        throw new CheckoutError('That quantity is unavailable. Choose fewer packs.');
      await tx.cartLine.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: { cartId: cart.id, variantId, quantity: next },
        update: { quantity: next },
      });
    } else await tx.cartLine.deleteMany({ where: { cartId: cart.id, variantId } });
    await tx.cart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 }, expiresAt: new Date(Date.now() + 30 * 86400000) },
    });
    return notices;
  });
}

export async function expireReservations(db: PrismaClient) {
  return db.$queryRaw`SELECT commerce.expire_reservations()`;
}
export async function placeOrder(
  db: PrismaClient,
  customerId: string,
  email: string,
  raw: CheckoutInput,
  allowSamples: boolean,
) {
  const input = checkoutSchema.parse(raw);
  if (!compatibleMethod(input.paymentMethod, input.method))
    throw new CheckoutError('Choose a payment method that matches delivery or collection.');
  const fingerprint = hash(JSON.stringify(input));
  // Separate transaction: never hold stock locks from expiry while waiting on a customer lock.
  await expireReservations(db);
  return withOwner(db, { customerId }, async (tx) => {
    const prior = await tx.order.findUnique({
      where: { customerId_key: { customerId, key: input.key } },
    });
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new CheckoutError('This checkout reference was already used. Open checkout again.');
      return prior.id;
    }
    const { cart } = await activeCart(tx, { customerId }, false);
    if (!cart?.lines.length) throw new CheckoutError('Your basket is empty.');
    await tx.$queryRaw`SELECT commerce.lock_checkout_settings()::text`;
    // Offer locks precede inventory locks; limited offers and daily capacity cannot oversubscribe.
    const basket = await quote(tx, cart, allowSamples, input.promotionCode, true);
    if (basket.promotionError) throw new CheckoutError(basket.promotionError);
    const ids = cart.lines.map((line) => line.variantId).sort();
    // Lock every balance in stable order before reading current availability.
    for (const id of ids) {
      await tx.$queryRaw`SELECT "variantId" FROM commerce."InventoryBalance" WHERE "variantId"=${id}::uuid FOR UPDATE`;
    }
    // Re-read stock after acquiring inventory locks; offer/settings locks remain held.
    const balances = await tx.inventoryBalance.findMany({ where: { variantId: { in: ids } } });
    for (const line of basket.lines) {
      const balance = balances.find((b) => b.variantId === line.variantId);
      line.available = balance ? Math.max(0, balance.onHand - balance.reserved) : 0;
    }
    if (isOnline(input.paymentMethod) && cents(basket.total) < 500n)
      throw new CheckoutError(
        'Payfast requires a total of at least R5.00. Choose another payment method.',
      );
    if (input.quote !== basket.quote)
      throw new CheckoutError(
        'Prices or basket details changed. Refresh checkout and review the new total.',
      );
    if (
      basket.settings.suspended ||
      (input.method === 'COLLECTION' && !basket.settings.collectionEnabled)
    )
      throw new CheckoutError('Ordering is temporarily unavailable.');
    let address: Snapshot['address'] = null;
    if (input.method === 'DELIVERY') {
      if (!basket.settings.deliveryEnabled || !input.addressId)
        throw new CheckoutError('Delivery is not available for this address. Choose collection.');
      const saved = await tx.address.findFirst({ where: { id: input.addressId, customerId } });
      const approval = await tx.deliveryApproval.findFirst({
        where: { addressId: input.addressId, customerId },
      });
      if (
        !saved ||
        !approval ||
        approval.expiresAt <= new Date() ||
        approval.zoneVersion !== basket.settings.version ||
        approval.addressHash !== addressHash(saved)
      )
        throw new CheckoutError(
          'This address needs delivery approval. Choose collection or contact the store.',
        );
      address = {
        recipient: saved.recipient,
        phone: saved.phone,
        street: saved.street,
        suburb: saved.suburb,
        city: saved.city,
        postalCode: saved.postalCode,
        instructions: saved.instructions,
      };
    }
    if (basket.lines.some((line) => line.quantity > line.available || !line.sku))
      throw new CheckoutError('Stock changed. Return to your basket and adjust quantities.');
    const now = new Date();
    const snapshot: Snapshot = {
      lines: basket.lines,
      subtotal: basket.subtotal,
      discount: basket.discount,
      promotion: basket.promotion,
      deliveryFee: '0.00',
      total: basket.total,
      name: input.name,
      phone: input.phone,
      email,
      address,
      planningDate: basket.planningDate,
      settingsVersion: basket.settings.version,
      policyVersion: input.policyVersion,
      acceptedAt: now.toISOString(),
      isTest: true,
      paymentMethod: input.paymentMethod,
    };
    const order = await tx.order.create({
      data: {
        id: randomUUID(),
        customerId,
        key: input.key,
        fingerprint,
        method: input.method,
        total: basket.total,
        paymentStatus: isOnline(input.paymentMethod) ? 'AWAITING_PAYMENT' : 'UNPAID',
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(now.getTime() + (holdMinutes(input.paymentMethod) ?? 525600) * 60000),
      },
    });
    if (input.paymentMethod !== 'TEST')
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: input.paymentMethod,
          state: isOnline(input.paymentMethod) ? 'AWAITING_PAYMENT' : 'UNPAID',
          expected: basket.total,
        },
      });
    if (basket.promotion)
      await tx.promotionRedemption.create({
        data: {
          promotionId: basket.promotion.id,
          orderId: order.id,
          customerId,
          discount: basket.discount,
        },
      });
    for (const line of basket.lines) {
      await tx.inventoryBalance.update({
        where: { variantId: line.variantId },
        data: { reserved: { increment: line.quantity }, version: { increment: 1 } },
      });
      await tx.inventoryReservation.create({
        data: { orderId: order.id, variantId: line.variantId, quantity: line.quantity },
      });
    }
    await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
    return order.id;
  });
}

export async function readOrders(db: PrismaClient, customerId: string, id?: string, page = 1) {
  if (id) z.uuid().parse(id);
  return withOwner(db, { customerId }, (tx) =>
    tx.order.findMany({
      where: { customerId, ...(id ? { id } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: id ? 1 : 20,
      skip: id ? 0 : (Math.max(1, Math.min(10000, page)) - 1) * 20,
    }),
  );
}
export async function reorder(
  db: PrismaClient,
  customerId: string,
  orderId: string,
  allowSamples: boolean,
) {
  z.uuid().parse(orderId);
  return withOwner(db, { customerId }, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, customerId } });
    if (!order) throw new CheckoutError('Order not found.');
    const { cart } = await activeCart(tx, { customerId }, true);
    const notices: string[] = [];
    let count = cart!.lines.length;
    for (const item of (order.snapshot as unknown as Snapshot).lines) {
      const variant = await tx.productVariant.findFirst({
        where: {
          id: item.variantId,
          active: true,
          product: {
            state: 'ACTIVE',
            category: { active: true },
            ...(allowSamples ? {} : { isSample: false }),
          },
        },
        include: { inventory: true },
      });
      const old = cart!.lines.find((line) => line.variantId === item.variantId)?.quantity || 0;
      if (!old && count >= 50) {
        notices.push(`${item.name}: basket limit reached.`);
        continue;
      }
      const available = variant?.inventory
        ? Math.max(0, variant.inventory.onHand - variant.inventory.reserved)
        : 0;
      const quantity = Math.min(99, available, old + item.quantity);
      if (quantity < old + item.quantity)
        notices.push(`${item.name}: unavailable packs were omitted.`);
      // Preserve existing basket selections; never silently reduce them on reorder.
      if (quantity > old) {
        await tx.cartLine.upsert({
          where: { cartId_variantId: { cartId: cart!.id, variantId: item.variantId } },
          create: { cartId: cart!.id, variantId: item.variantId, quantity },
          update: { quantity },
        });
        if (!old) count++;
      }
    }
    await tx.cart.update({ where: { id: cart!.id }, data: { version: { increment: 1 } } });
    return ['Available items added at current prices. Review your basket.', ...notices];
  });
}
