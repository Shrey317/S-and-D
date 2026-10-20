import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { loadLocalEnvironment, assertLocalTarget, toolingDatabase } from './database-tools';
import { cleanupTestOrders } from './payment-test-fixtures';
import { assertCommunicationsRole } from '../src/server/db/communications-permissions';
import { runMailBatch, claimMessage, type MailRequest } from '../src/server/communications/worker';
import { recordDelivery } from '../src/server/communications/delivery';
import {
  prepareWhatsapp,
  openWhatsapp,
  markWhatsapp,
  resendNotice,
  readNotification,
} from '../src/server/communications/admin';
import { readReports } from '../src/server/reports/repository';
import { reportWorkbook } from '../src/server/reports/workbook';
import { changeBasket, readBasket, placeOrder } from '../src/server/checkout/repository';
import {
  recordVerifiedReceipt,
  requestRefund,
  resolveRefund,
} from '../src/server/payments/repository';
import { completeOrder } from '../src/server/admin/repository';
import { POLICY_VERSION } from '../src/features/checkout/rules';
import { readCatalog } from '../src/server/catalog/repository';
import { parseFilters } from '../src/features/catalog/filters';
loadLocalEnvironment();
const urls = [
  process.env.TEST_DATABASE_URL!,
  process.env.TEST_COMMUNICATIONS_DATABASE_URL!,
  process.env.TEST_ADMIN_DATABASE_URL!,
  process.env.TEST_COMMERCE_DATABASE_URL!,
  process.env.TEST_PAYMENT_DATABASE_URL!,
];
for (const url of urls) {
  assertLocalTarget(url, 'test');
  assert.equal(new URL(url).pathname, '/sd_catalog_test');
}
const [db, worker, admin, commerce, payments] = urls.map(toolingDatabase) as [
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
];
const actor = randomUUID(),
  customer = randomUUID(),
  reason = 'Local communications integration fixture',
  capture = { enabled: false, capture: true, siteUrl: 'http://127.0.0.1:3100' },
  hosted = {
    enabled: true,
    capture: false,
    siteUrl: 'https://store.example.test',
    from: 'orders@example.test',
    adminEmail: 'admin@example.test',
  };
const neverSend = async () => {
  throw new Error('External delivery must never run');
};
let orderId = '',
  passed = 0,
  stage = 'setup';
async function check(name: string, work: () => Promise<void>) {
  stage = name;
  await work();
  passed++;
  console.log(`PASS ${name}`);
}
async function copyMessage() {
  const original = await db.emailMessage.findFirstOrThrow({
    where: { orderId, kind: 'ORDER_RECEIVED', audience: 'CUSTOMER' },
  });
  return db.emailMessage.create({
    data: {
      orderId,
      kind: original.kind,
      audience: original.audience,
      eventKey: `fixture:${randomUUID()}`,
      payload: {
        ...(original.payload as object),
        snapshot: { ...(original.payload as { snapshot: object }).snapshot, isTest: false },
      },
    },
  });
}
try {
  await db.administratorGrant.create({ data: { customerId: actor, reason } });
  await check(
    'worker has only communications privileges and cannot access accounts, orders or money',
    async () => {
      await assertCommunicationsRole(worker);
      await assert.rejects(assertCommunicationsRole(db));
      await assert.rejects(assertCommunicationsRole(admin));
      await assert.rejects(worker.order.findMany());
      await assert.rejects(worker.payment.updateMany({ data: { state: 'PAID' } }));
      await assert.rejects(worker.emailMessage.deleteMany());
      await assert.rejects(worker.emailMessage.updateMany({ data: { payload: {} } }));
    },
  );
  await check('order and notices commit together once and roll back together', async () => {
    const v = await db.productVariant.findFirstOrThrow({
      where: { product: { slug: 'sample-apples' }, label: '500 g pack' },
    });
    await changeBasket(commerce, { customerId: customer }, v.id, 1, 'add', true);
    const b = await readBasket(commerce, { customerId: customer }, true),
      input = {
        key: randomUUID(),
        quote: b.quote,
        name: '=Unsafe spreadsheet name',
        phone: '0835043385',
        method: 'COLLECTION' as const,
        paymentMethod: 'COLLECTION' as const,
        accepted: true as const,
        policyVersion: POLICY_VERSION as typeof POLICY_VERSION,
      };
    orderId = await placeOrder(commerce, customer, 'customer@example.test', input, true);
    assert.equal(
      await placeOrder(commerce, customer, 'customer@example.test', input, true),
      orderId,
    );
    assert.equal(await db.emailMessage.count({ where: { orderId } }), 2);
    assert.equal(await db.adminNotification.count({ where: { orderId } }), 1);
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
        throw new Error('Rollback fixture');
      }),
    );
    assert.equal(await db.emailMessage.count({ where: { orderId } }), 2);
  });
  await check(
    'verified payment and completion queue distinct notices and never send in the transaction',
    async () => {
      const p = await db.payment.findUniqueOrThrow({ where: { orderId } });
      await recordVerifiedReceipt(payments, actor, {
        paymentId: p.id,
        key: randomUUID(),
        amount: p.expected.toFixed(2),
        reference: `cash-${randomUUID()}`,
        reason,
        verified: true,
      });
      await completeOrder(admin, actor, orderId, reason);
      assert.deepEqual(
        (
          await db.emailMessage.findMany({
            where: { orderId, audience: 'CUSTOMER' },
            orderBy: { kind: 'asc' },
          })
        ).map((m) => m.kind),
        ['FULFILMENT_COMPLETED', 'ORDER_RECEIVED', 'PAYMENT_CONFIRMED'],
      );
      assert.equal(await db.emailAttempt.count(), 0);
    },
  );
  await check(
    'concurrent workers claim distinct rows and local test messages never contact the provider',
    async () => {
      await Promise.all([
        runMailBatch(worker, capture, neverSend, 1),
        runMailBatch(worker, capture, neverSend, 1),
      ]);
      await runMailBatch(worker, capture, neverSend, 20);
      const messages = await db.emailMessage.findMany({ where: { orderId } });
      assert.ok(messages.every((m) => m.status === 'CAPTURED' && m.attempts === 1));
      assert.ok(
        messages.every((m) => (m.request as { text: string }).text.includes('Local test record')),
      );
    },
  );
  await check(
    'uncertain provider outcomes retry the frozen request and stable idempotency key',
    async () => {
      const m = await copyMessage(),
        providerId = randomUUID(),
        requests: { request: MailRequest; key: string }[] = [];
      const send = async (request: MailRequest, key: string) => {
        requests.push({ request, key });
        if (requests.length === 1) throw new Error('Timeout after provider accepted');
        return providerId;
      };
      await runMailBatch(worker, hosted, send, 1);
      assert.equal(
        (await db.emailMessage.findUniqueOrThrow({ where: { id: m.id } })).status,
        'PENDING',
      );
      await db.emailMessage.update({ where: { id: m.id }, data: { availableAt: new Date(0) } });
      await runMailBatch(worker, { ...hosted, from: 'changed@example.test' }, send, 1);
      assert.deepEqual(requests[0], requests[1]);
      assert.equal(
        (await db.emailMessage.findUniqueOrThrow({ where: { id: m.id } })).status,
        'ACCEPTED',
      );
      assert.equal(await db.emailAttempt.count({ where: { messageId: m.id } }), 2);
    },
  );
  await check('expired leases recover and exhausted retry windows require review', async () => {
    const m = await copyMessage(),
      claimed = await claimMessage(worker);
    assert.equal(claimed?.id, m.id);
    await db.emailMessage.update({ where: { id: m.id }, data: { leaseUntil: new Date(0) } });
    await runMailBatch(worker, hosted, async () => randomUUID(), 1);
    assert.equal(
      (
        await db.emailAttempt.findUniqueOrThrow({
          where: { messageId_number: { messageId: m.id, number: 1 } },
        })
      ).status,
      'ABANDONED',
    );
    const stale = await copyMessage();
    await db.emailMessage.update({
      where: { id: stale.id },
      data: { firstAttemptAt: new Date(Date.now() - 24 * 3600000), attempts: 1 },
    });
    await runMailBatch(worker, hosted, neverSend, 1);
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { id: stale.id } })).status,
      'REVIEW',
    );
    assert.equal(
      await db.adminNotification.count({ where: { eventKey: `email-review:${stale.id}` } }),
      1,
    );
  });
  await check('a stale worker cannot overwrite a newer lease result', async () => {
    const message = await copyMessage();
    let release!: (id: string) => void, started!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const slow = runMailBatch(
      worker,
      hosted,
      async () => {
        started();
        return new Promise<string>((resolve) => {
          release = resolve;
        });
      },
      1,
    );
    await startedPromise;
    await db.emailMessage.update({ where: { id: message.id }, data: { leaseUntil: new Date(0) } });
    const winner = randomUUID();
    await runMailBatch(worker, hosted, async () => winner, 1);
    release(randomUUID());
    await slow;
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { id: message.id } })).providerId,
      winner,
    );
  });
  await check(
    'early delivery events persist idempotently and bounced recipients are suppressed',
    async () => {
      const providerId = randomUUID(),
        event = {
          id: `event-${randomUUID()}`,
          providerId,
          type: 'email.bounced',
          occurredAt: new Date(),
        };
      await recordDelivery(worker, event);
      await recordDelivery(worker, event);
      assert.equal(await db.emailDelivery.count({ where: { id: event.id } }), 1);
      await assert.rejects(recordDelivery(worker, { ...event, type: 'email.delivered' }));
      const existing = await db.emailMessage.findFirstOrThrow({
        where: { orderId, status: 'ACCEPTED' },
      });
      await db.emailMessage.update({ where: { id: existing.id }, data: { providerId } });
      const next = await copyMessage();
      await runMailBatch(worker, hosted, neverSend, 1);
      assert.equal(
        (await db.emailMessage.findUniqueOrThrow({ where: { id: next.id } })).status,
        'FAILED',
      );
    },
  );
  await check(
    'manual WhatsApp opening, sending attestation and audited resends are distinct',
    async () => {
      const key = randomUUID(),
        id = await prepareWhatsapp(admin, actor, orderId, key);
      assert.equal(await prepareWhatsapp(admin, actor, orderId, key), id);
      assert.equal(
        (await db.manualCommunication.findUniqueOrThrow({ where: { id } })).state,
        'PREPARED',
      );
      await assert.rejects(markWhatsapp(admin, actor, id, true, reason));
      const url = await openWhatsapp(admin, actor, id);
      assert.ok(url.startsWith('https://wa.me/27835043385?text='));
      assert.equal(
        (await db.manualCommunication.findUniqueOrThrow({ where: { id } })).state,
        'OPENED',
      );
      await assert.rejects(markWhatsapp(admin, actor, id, false, reason));
      await markWhatsapp(admin, actor, id, true, reason);
      await markWhatsapp(admin, actor, id, true, reason);
      assert.equal(
        await db.adminAudit.count({ where: { entityId: id, action: 'MARK_WHATSAPP_SENT' } }),
        1,
      );
      const source = await db.emailMessage.findFirstOrThrow({
          where: { orderId, audience: 'CUSTOMER', status: 'CAPTURED' },
        }),
        resendKey = randomUUID();
      await assert.rejects(resendNotice(admin, actor, source.id, resendKey, false));
      const extra = await resendNotice(admin, actor, source.id, resendKey, true);
      assert.equal(await resendNotice(admin, actor, source.id, resendKey, true), extra);
      await assert.rejects(prepareWhatsapp(admin, randomUUID(), orderId, randomUUID()));
      const note = await db.adminNotification.findFirstOrThrow({ where: { orderId } });
      await readNotification(admin, actor, note.id);
      assert.ok((await db.adminNotification.findUniqueOrThrow({ where: { id: note.id } })).readAt);
    },
  );
  await check(
    'reports exclude tests and retain full refund accounting within SAST order dates',
    async () => {
      const testOnly = await readReports(admin, {});
      assert.equal(testOnly.totals.net, '0.00');
      assert.deepEqual(testOnly.performance, []);
      const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      await db.order.update({
        where: { id: orderId },
        data: { snapshot: { ...(o.snapshot as object), isTest: false } },
      });
      const before = await readReports(admin, {});
      assert.equal(before.totals.net, o.total.toFixed(2));
      const readerUrl = process.env.TEST_READER_URL!;
      assertLocalTarget(readerUrl, 'test');
      assert.equal(new URL(readerUrl).pathname, '/sd_catalog_test');
      const reader = toolingDatabase(readerUrl);
      const apple = await db.product.findUniqueOrThrow({ where: { slug: 'sample-apples' } });
      try {
        await assert.rejects(reader.order.findMany());
        assert.equal(
          (
            await readCatalog(reader, parseFilters({ selection: 'popular' }), {
              allowSamples: true,
            })
          ).total,
          0,
        );
        await db.product.update({ where: { id: apple.id }, data: { isSample: false } });
        const popular = await readCatalog(reader, parseFilters({ selection: 'popular' }), {
          allowSamples: true,
        });
        assert.deepEqual(
          popular.products.map((p) => p.id),
          [apple.id],
        );
        await db.order.update({
          where: { id: orderId },
          data: { snapshot: { ...(o.snapshot as object), isTest: true } },
        });
        assert.equal(
          (
            await readCatalog(reader, parseFilters({ selection: 'popular' }), {
              allowSamples: true,
            })
          ).total,
          0,
        );
        await db.order.update({
          where: { id: orderId },
          data: { snapshot: { ...(o.snapshot as object), isTest: false } },
        });
      } finally {
        await db.product.update({ where: { id: apple.id }, data: { isSample: apple.isSample } });
        await reader.$disconnect();
      }
      assert.deepEqual(before.performance, [
        { status: 'COLLECTED', method: 'COLLECTION', orders: 1 },
      ]);
      const p = await db.payment.findUniqueOrThrow({ where: { orderId } }),
        r = await requestRefund(payments, actor, {
          paymentId: p.id,
          key: randomUUID(),
          amount: p.expected.toFixed(2),
          reason,
        });
      await resolveRefund(payments, actor, r, 'COMPLETE', `refund-${randomUUID()}`, reason);
      const after = await readReports(admin, {});
      assert.equal(after.totals.net, '0.00');
      assert.equal(after.totals.refunds, o.total.toFixed(2));
      assert.equal(after.totals.orders, 1);
      assert.equal(after.bestsellers.length, 0);
      assert.equal(
        await db.emailMessage.count({ where: { orderId, kind: 'REFUND_COMPLETED' } }),
        1,
      );
    },
  );
  await check(
    'Excel workbook has numeric currency, matching totals and inert customer cells',
    async () => {
      const report = await readReports(admin, {}),
        bytes = await reportWorkbook(report),
        book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes);
      assert.equal(book.worksheets.length, 8);
      assert.equal(book.getWorksheet('Order performance')!.getCell('C2').value, 1);
      assert.equal(book.getWorksheet('Summary')!.getCell('B8').value, 0);
      assert.equal(book.getWorksheet('Orders')!.getCell('D2').value, "'=Unsafe spreadsheet name");
      assert.equal(typeof book.getWorksheet('Orders')!.getCell('E2').value, 'number');
      assert.ok(book.getWorksheet('Daily sales')!.getColumn(3).numFmt?.includes('R'));
    },
  );
  console.log(`${passed} communications and reporting integration checks passed.`);
} catch (e) {
  console.error(`FAILED ${stage}`);
  throw e;
} finally {
  await cleanupTestOrders(db, [customer]);
  await db.cart.deleteMany({ where: { customerId: customer } });
  await db.adminAudit.deleteMany({ where: { actorId: actor } });
  await db.administratorGrant.deleteMany({ where: { customerId: actor } });
  await Promise.all([db, worker, admin, commerce, payments].map((d) => d.$disconnect()));
}
