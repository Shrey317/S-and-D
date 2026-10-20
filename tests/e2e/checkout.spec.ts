import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { toolingDatabase, assertLocalTarget } from '../../scripts/database-tools';
import { cleanupTestOrders } from '../../scripts/payment-test-fixtures';

test.describe('local checkout', () => {
  test.skip(!process.env.TEST_COMMERCE_DATABASE_URL, 'Local checkout configuration required.');
  test.setTimeout(90000);
  test('guest basket survives reload and removal; checkout requires sign-in', async ({
    page,
    context,
  }) => {
    await page.goto('/shop/sample-pears');
    await page.getByLabel('Quantity', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Basket updated.' })).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === 'sd_guest_cart');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    const response = await page.goto('/cart');
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('2');
    await page.reload();
    await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('2');
    await page.getByRole('link', { name: 'Continue to checkout' }).click();
    await expect(page).toHaveURL(/auth\/sign-in\?next=%2Fcheckout/);
    await page.goto('/cart');
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your basket is empty' })).toBeVisible();
  });
  test('guest merge, collection checkout, private confirmation and reorder', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321')
      throw new Error('Loopback Auth only.');
    assertLocalTarget(process.env.TEST_DATABASE_URL!, 'test');
    if (new URL(process.env.TEST_DATABASE_URL!).pathname !== '/sd_catalog_test')
      throw new Error('Test database only.');
    const admin = createClient(
      'http://127.0.0.1:54321',
      JSON.parse(readFileSync('.local/auth-test-secrets.json', 'utf8')).serviceRole,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const email = `checkout-${randomUUID()}@example.test`,
      password = `Sd-${randomBytes(18).toString('hex')}!`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Local account creation failed.');
    const customerId = created.data.user.id,
      db = toolingDatabase(process.env.TEST_DATABASE_URL!);
    try {
      await page.goto('/shop/sample-pears');
      await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Basket updated.' })).toBeVisible();
      await page.goto('/checkout');
      await page.getByLabel('Email address').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await page.getByLabel('Contact name').fill('Checkout Test');
      await page.getByLabel('Phone number').fill('0835043385');
      await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
      await expect(page.getByText(/1 × Pears/)).toBeVisible();
      await page.getByLabel(/I understand this is a local test order/).check();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: testInfo.outputPath('checkout.png'), fullPage: true });
      await page.getByRole('button', { name: 'Create local test order' }).click();
      await expect(page.getByRole('heading', { name: 'Test order created' })).toBeVisible();
      await expect(page.getByText('Unpaid', { exact: true })).toBeVisible();
      const confirmation = page.url(),
        orderId = confirmation.split('/').pop()!;
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Test order created' })).toBeVisible();
      expect(await db.order.count({ where: { customerId } })).toBe(1);
      await expect(page.getByText('Pending', { exact: true })).toBeVisible();
      const payment = await db.payment.findUnique({ where: { orderId } });
      expect(payment?.method).toBe('COLLECTION');
      const statusResponse = await page.goto(`/payments/${payment!.id}/status?return=success`);
      expect(statusResponse?.headers()['cache-control']).toContain('no-store');
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment!.id } })).state).toBe(
        'UNPAID',
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('payment-status.png'), fullPage: true });
      await page.goto(confirmation);
      await page.screenshot({ path: testInfo.outputPath('confirmation.png'), fullPage: true });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const stranger = await browser.newContext();
      const privatePage = await stranger.newPage();
      await privatePage.goto(confirmation);
      await expect(privatePage).toHaveURL(/auth\/sign-in/);
      await privatePage.goto(`/payments/${payment!.id}/status`);
      await expect(privatePage).toHaveURL(/auth\/sign-in/);
      expect((await privatePage.goto(`/admin/payments/${payment!.id}`))?.status()).toBe(404);
      await stranger.close();
      expect((await page.goto(`/payments/${randomUUID()}/status`))?.status()).toBe(404);
      expect((await page.goto(`/admin/payments/${payment!.id}`))?.status()).toBe(404);
      const forged = await page.request.post('/api/payments/payfast/notify', {
        headers: {
          'x-nf-client-connection-ip': '144.126.193.139',
          'content-type': 'application/x-www-form-urlencoded',
        },
        data: 'payment_status=COMPLETE&amount_gross=5.50',
      });
      expect(forged.status()).toBe(503);
      // Valid account cannot obtain another customer's confirmation by replacing the URL ID.
      const foreign = randomUUID();
      await db.order.create({
        data: {
          id: foreign,
          customerId: randomUUID(),
          key: randomUUID(),
          fingerprint: 'a'.repeat(64),
          method: 'COLLECTION',
          total: '0.00',
          snapshot: {},
          expiresAt: new Date(Date.now() + 1200000),
        },
      });
      try {
        const result = await page.goto(`/checkout/confirmation/${foreign}`);
        expect(result?.status()).toBe(404);
      } finally {
        await db.order.delete({ where: { id: foreign } });
      }
      await page.goto(`/account/orders/${orderId}`);
      await page.getByRole('button', { name: 'Add available items to basket' }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Available items added at current prices' }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'View basket', exact: true }).click();
      await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('1');
      await page.goto('/account/orders');
      await expect(page.getByRole('link', { name: `Order ${orderId}` })).toBeVisible();
      const authCookies = (await context.cookies()).filter((c) => c.name.startsWith('sb-'));
      expect(authCookies.length).toBeGreaterThan(0);
    } finally {
      await cleanupTestOrders(db, [customerId]);
      await db.cart.deleteMany({ where: { customerId } });
      await db.customerProfile.deleteMany({ where: { id: customerId } });
      await admin.auth.admin.deleteUser(customerId);
      await db.$disconnect();
    }
  });
});
