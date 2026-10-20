import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { toolingDatabase, assertLocalTarget } from '../../scripts/database-tools';
import { cleanupTestOrders } from '../../scripts/payment-test-fixtures';

test.describe('real local Supabase accounts', () => {
  test.skip(!process.env.TEST_ACCOUNT_DATABASE_URL, 'Local Auth configuration is required.');
  test.setTimeout(90000);
  const created = new Set<string>();
  function admin() {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321')
      throw new Error('Auth tests are loopback-only.');
    return createClient(
      'http://127.0.0.1:54321',
      JSON.parse(readFileSync('.local/auth-test-secrets.json', 'utf8')).serviceRole,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  const credentials = () => ({
    email: `e2e-${randomUUID()}@example.test`,
    password: `Sd-${randomBytes(18).toString('hex')}!`,
  });
  async function makeAccount() {
    const input = credentials();
    const { data, error } = await admin().auth.admin.createUser({
      ...input,
      email_confirm: true,
      user_metadata: { role: 'ADMIN' },
    });
    if (error || !data.user) throw new Error('Local test account creation failed.');
    created.add(data.user.id);
    return { ...input, id: data.user.id };
  }
  async function signIn(page: Page, input: { email: string; password: string }) {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(input.email);
    await page.getByLabel('Password', { exact: true }).fill(input.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
  }
  async function emailLink(request: APIRequestContext, email: string, subject: RegExp) {
    let id: string | undefined;
    await expect
      .poll(async () => {
        const data = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json();
        id = data.messages.find(
          (item: { To: { Address: string }[]; Subject: string }) =>
            item.To.some((to) => to.Address === email) && subject.test(item.Subject),
        )?.ID;
        return Boolean(id);
      })
      .toBe(true);
    const data = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${id}`)).json();
    const url = String(data.HTML)
      .match(/href="(http:\/\/127\.0\.0\.1:54321[^\"]+)"/)?.[1]
      ?.replaceAll('&amp;', '&');
    if (!url) throw new Error('Local confirmation link missing.');
    return url;
  }
  test.afterEach(async () => {
    if (!created.size) return;
    const url = process.env.TEST_DATABASE_URL!;
    assertLocalTarget(url, 'test');
    if (new URL(url).pathname !== '/sd_catalog_test') throw new Error('Test DB only.');
    const db = toolingDatabase(url);
    try {
      await cleanupTestOrders(db, [...created]);
      const audits = await db.adminAudit.findMany({ where: { actorId: { in: [...created] } } });
      const productIds = audits.filter((a) => a.action === 'CREATE_PRODUCT').map((a) => a.entityId);
      await db.promotion.deleteMany({
        where: {
          id: { in: audits.filter((a) => a.action === 'CREATE_PROMOTION').map((a) => a.entityId) },
        },
      });
      await db.inventoryAdjustment.deleteMany({ where: { actorId: { in: [...created] } } });
      await db.productImage.deleteMany({ where: { productId: { in: productIds } } });
      await db.inventoryBalance.deleteMany({
        where: { variant: { productId: { in: productIds } } },
      });
      await db.productVariant.deleteMany({ where: { productId: { in: productIds } } });
      await db.product.deleteMany({ where: { id: { in: productIds } } });
      await db.adminAudit.deleteMany({ where: { actorId: { in: [...created] } } });
      await db.cart.deleteMany({ where: { customerId: { in: [...created] } } });
      await db.administratorGrant.deleteMany({ where: { customerId: { in: [...created] } } });
      await db.customerProfile.deleteMany({ where: { id: { in: [...created] } } });
      for (const id of created) await admin().auth.admin.deleteUser(id);
      created.clear();
    } finally {
      await db.$disconnect();
    }
  });

  test('registration requires email confirmation and recovery changes the password', async ({
    page,
    request,
  }) => {
    const input = credentials();
    await page.goto('/auth/register');
    await page.getByLabel('Email address').fill(input.email);
    await page.getByLabel('New password', { exact: true }).fill(input.password);
    await page.getByLabel('Confirm password').fill(input.password);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('check your email');
    const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((item) => item.email === input.email);
    expect(user?.email_confirmed_at).toBeFalsy();
    if (user) created.add(user.id);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    const confirmation = await emailLink(request, input.email, /confirm/i);
    await page.goto(confirmation);
    await expect(page).toHaveURL(/\/account$/);
    const response = await page.reload();
    expect(response?.headers()['cache-control']).toContain('no-store');
    const cookies = await page.context().cookies();
    expect(
      cookies
        .filter((cookie) => cookie.name.startsWith('sb-'))
        .every((cookie) => cookie.httpOnly && cookie.sameSite === 'Lax'),
    ).toBe(true);
    // Expire only stored session metadata; keep genuine provider-issued tokens.
    // The proxy must rotate the real refresh token and persist its replacement.
    const tokenCookies = cookies
      .filter((cookie) => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const storedSession = JSON.parse(
      Buffer.from(
        tokenCookies
          .map((cookie) => cookie.value)
          .join('')
          .slice(7),
        'base64url',
      ).toString('utf8'),
    );
    const oldRefreshToken = storedSession.refresh_token;
    storedSession.expires_at = Math.floor(Date.now() / 1000) - 30;
    await page.context().clearCookies({ name: /^sb-.*-auth-token(?:\.\d+)?$/ });
    await page.context().addCookies([
      {
        ...tokenCookies[0]!,
        name: tokenCookies[0]!.name.replace(/\.\d+$/, ''),
        value: `base64-${Buffer.from(JSON.stringify(storedSession)).toString('base64url')}`,
      },
    ]);
    await page.reload();
    await expect(page).toHaveURL(/\/account$/);
    const refreshedCookies = (await page.context().cookies())
      .filter((cookie) => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const refreshedSession = JSON.parse(
      Buffer.from(
        refreshedCookies
          .map((cookie) => cookie.value)
          .join('')
          .slice(7),
        'base64url',
      ).toString('utf8'),
    );
    expect(refreshedSession.refresh_token !== oldRefreshToken).toBe(true);
    await page.getByRole('button', { name: 'Sign out everywhere' }).click();
    await signIn(page, input);
    await page.getByRole('button', { name: 'Sign out everywhere' }).click();
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email address').fill(input.email);
    await page.getByRole('button', { name: 'Request reset link' }).click();
    await expect(page.getByRole('status')).toContainText('If this address has an account');
    await page.goto(await emailLink(request, input.email, /reset/i));
    await expect(page).toHaveURL(/\/auth\/reset-password$/);
    const newPassword = credentials().password;
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm password').fill(newPassword);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page).toHaveURL(/changed=1/);
    const oldLogin = await createClient(
      'http://127.0.0.1:54321',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    ).auth.signInWithPassword(input);
    expect(oldLogin.error).not.toBeNull();
    await signIn(page, { email: input.email, password: newPassword });
    await page.goto(confirmation);
    await expect(page).toHaveURL(/\/auth\/error/);
  });

  test('profile, address and wishlist persist and remain isolated from a second customer', async ({
    page,
    browser,
  }, testInfo) => {
    const first = await makeAccount(),
      second = await makeAccount();
    await signIn(page, first);
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByLabel('Full name').fill('Local Test Customer');
    await page.getByLabel('South African phone number (optional)').fill('0835043385');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status')).toContainText('Profile saved');
    await page.reload();
    await expect(page.getByLabel('Full name')).toHaveValue('Local Test Customer');
    await page.getByRole('link', { name: 'Addresses', exact: true }).click();
    const address = {
      'Address label': 'Test home',
      'Recipient name': 'Local Test Customer',
      'South African phone number': '0835043385',
      'Street address': '1 Test Street',
      Suburb: 'Lenasia',
      City: 'Johannesburg',
      'Postal code': '1827',
    };
    for (const [label, value] of Object.entries(address))
      await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save address' }).click();
    await expect(page.getByRole('heading', { name: 'Test home · Default' })).toBeVisible();
    const editHref = await page.getByRole('link', { name: 'Edit Test home' }).getAttribute('href');
    const addressId = new URL(editHref!, 'http://127.0.0.1:3100').searchParams.get('edit')!;
    const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
    try {
      const other = await otherContext.newPage();
      await signIn(other, second);
      await other.goto(`/account/addresses?edit=${addressId}`);
      await expect(other.getByText('You haven’t saved an address yet.')).toBeVisible();
      for (const [label, value] of Object.entries(address))
        await other.getByLabel(label, { exact: true }).fill(value);
      await other.locator('#address-form form').evaluate((form, id) => {
        const input = document.createElement('input');
        input.name = 'id';
        input.type = 'hidden';
        input.value = id;
        form.append(input);
      }, addressId);
      await other.getByRole('button', { name: 'Save address' }).click();
      await expect(other.locator('form').getByRole('alert')).toContainText('Unable to save');
    } finally {
      await otherContext.close();
    }
    await page.goto('/shop/sample-apples');
    await page.getByRole('button', { name: 'Save to wishlist' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Saved to your wishlist' }),
    ).toBeVisible();
    await page.goto('/account/wishlist');
    await expect(page.getByRole('heading', { name: /apples/i })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('account-wishlist.png'), fullPage: true });
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'Remove from wishlist' }).click();
    await expect(
      page.getByRole('heading', { name: 'Make room for your favourites' }),
    ).toBeVisible();
    await page.goto('/account/addresses');
    await page.getByRole('button', { name: 'Remove Test home' }).click();
    await expect(page.getByText('You haven’t saved an address yet.')).toBeVisible();
  });

  test('forged sessions and callbacks cannot unlock accounts or admin', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'sb-127-auth-token',
        value: `base64-${Buffer.from(JSON.stringify({ access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: randomUUID(), role: 'service_role', aal: 'aal2', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.Zm9yZ2Vk`, refresh_token: 'forged', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: randomUUID() } })).toString('base64url')}`,
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await page.goto('/account/profile');
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    expect((await page.goto('/admin'))?.status()).toBe(404);
    await page.goto('/auth/callback?code=invalid&next=https://evil.example');
    await expect(page).toHaveURL('http://127.0.0.1:3100/auth/error');
    await page.context().clearCookies();
    await signIn(page, await makeAccount());
    expect((await page.goto('/admin'))?.status()).toBe(404);
    for (const route of [
      '/admin/communications',
      '/admin/notifications',
      '/admin/reports',
      '/admin/reports/export',
    ])
      expect((await page.goto(route))?.status()).toBe(404);
    expect(
      (
        await page.request.post('/api/email/events', { data: { type: 'email.delivered' } })
      ).status(),
    ).toBe(503);
    expect((await page.request.post('/api/jobs/email')).status()).toBe(503);
    expect(
      (
        await page.request.post('/admin/communications/whatsapp/open', {
          form: { id: randomUUID() },
          headers: { origin: 'http://127.0.0.1:3100' },
        })
      ).status(),
    ).toBe(404);
    await page.goto('/auth/reset-password');
    const password = credentials().password;
    await page.getByLabel('New password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.locator('form').getByRole('alert')).toContainText(
      'fresh password reset link',
    );
  });

  test('operator grant requires a real MFA session before administrator access', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    const account = await makeAccount();
    const db = toolingDatabase(process.env.TEST_DATABASE_URL!);
    try {
      await db.administratorGrant.create({
        data: { customerId: account.id, reason: 'Isolated browser test only' },
      });
    } finally {
      await db.$disconnect();
    }
    await signIn(page, account);
    expect((await page.goto('/admin'))?.status()).toBe(404);
    await page.goto('/account/security');
    await page.getByRole('button', { name: 'Set up authenticator' }).click();
    const setup = page.getByLabel('Authenticator setup key');
    await expect(setup).toBeVisible();
    const secret = (await setup.textContent())!;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bits = [...secret.toUpperCase()]
      .map((char) => alphabet.indexOf(char).toString(2).padStart(5, '0'))
      .join('');
    const key = Buffer.from((bits.match(/.{8}/g) || []).map((byte) => Number.parseInt(byte, 2)));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const digest = createHmac('sha1', key).update(counter).digest();
    const offset = digest[digest.length - 1]! & 15;
    const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
    await page.getByLabel('Six-digit authenticator code').fill(code);
    await page.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
    await expect(page.getByText(/This session has two-step verification/)).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Store overview' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('admin-overview.png'), fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const tag = randomUUID().slice(0, 8),
      productName = `Browser test ${tag}`,
      offerCode = `BROWSER-${tag.toUpperCase()}`;
    await page.goto('/admin/products/new');
    await page.getByLabel('Product name', { exact: true }).fill(productName);
    await page.getByLabel('URL slug').fill(`browser-test-${tag}`);
    await page.getByLabel('Description', { exact: true }).fill('Disposable browser test produce.');
    await page.getByLabel('Reason for this change').fill('Local browser product fixture');
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[a-f0-9-]{36}$/);
    const productPath = new URL(page.url()).pathname;
    const variant = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Add variant', exact: true }) });
    await variant.getByLabel('SKU', { exact: true }).fill(`BROWSER-${tag}`);
    await variant.getByLabel('Pack size / variant label').fill('Test box');
    await variant.getByLabel('Selling unit').selectOption('BOX');
    await variant.getByLabel('Price (ZAR, two decimals)').fill('12.00');
    await variant.getByLabel('Reason for this change').fill('Local browser variant fixture');
    await variant.getByRole('button', { name: 'Add variant', exact: true }).click();
    await expect(variant.getByRole('status')).toContainText('Variant saved');
    await page.goto(`/admin/inventory?q=${encodeURIComponent(productName)}`);
    await page.getByLabel('Counted physical packs').fill('7');
    await page.getByLabel('Reason for this change').fill('Local browser stock correction');
    await page.getByRole('button', { name: 'Record stock correction' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Stock correction recorded' }),
    ).toBeVisible();
    await expect(page.getByText(/Physical 7/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('admin-inventory.png'), fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto(productPath);
    const product = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Save product', exact: true }) });
    await product.getByLabel('Status', { exact: true }).selectOption('ARCHIVED');
    await product.getByLabel('Reason for this change').fill('Archive local browser fixture');
    await product.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect(product.getByLabel('Status', { exact: true })).toHaveValue('ARCHIVED');
    await expect
      .poll(
        async () =>
          (await db.product.findUniqueOrThrow({ where: { id: productPath.split('/').pop()! } }))
            .state,
      )
      .toBe('ARCHIVED');
    await page.goto('/admin/promotions/new');
    await page.getByLabel('Promotion name', { exact: true }).fill(`Browser offer ${tag}`);
    await page.getByLabel('Optional code (blank applies automatically)').fill(offerCode);
    await page.getByLabel('Discount type').selectOption('FIXED');
    await page.getByLabel('Percentage or discount in ZAR (two decimals)').fill('2.50');
    const sast = (date: Date) => new Date(date.getTime() + 7200000).toISOString().slice(0, 16);
    await page.getByLabel('Starts (Johannesburg time)').fill(sast(new Date(Date.now() - 86400000)));
    await page.getByLabel('Ends (Johannesburg time)').fill(sast(new Date(Date.now() + 86400000)));
    await page.getByLabel('Active during these dates').check();
    await page.getByLabel('Reason for this change').fill('Local browser discount fixture');
    await page.getByRole('button', { name: 'Save promotion', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/promotions\/[a-f0-9-]{36}$/);
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Store settings', exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    // Exercise reconciliation with the same real AAL2 administrator session.
    await page.goto('/shop/sample-pears');
    await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Basket updated.' })).toBeVisible();
    await page.goto(`/checkout?promotion=${offerCode}`);
    await expect(page.getByText(`Browser offer ${tag}`, { exact: false })).toBeVisible();
    await page.getByLabel('Contact name').fill('Payment Admin Test');
    await page.getByLabel('Phone number').fill('0835043385');
    await page.getByLabel(/I understand this is a local test order/).check();
    await page.getByRole('button', { name: 'Create local test order' }).click();
    await expect(page.getByRole('heading', { name: 'Test order created' })).toBeVisible();
    const orderId = page.url().split('/').pop()!;
    const payment = await db.payment.findUniqueOrThrow({ where: { orderId } });
    await page.goto(`/admin/payments/${payment.id}`);
    const receipt = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Record verified receipt', exact: true }) });
    await receipt
      .getByLabel('Bank, cash or Payfast transaction reference')
      .fill(`cash-${randomUUID()}`);
    await receipt
      .getByLabel('Verification evidence and reason')
      .fill('Local test cash fixture verified');
    await receipt.getByLabel(/I checked the external record/).check();
    await receipt.getByRole('button', { name: 'Record verified receipt', exact: true }).click();
    await expect(receipt.getByRole('status')).toContainText('Verified receipt recorded');
    await page.goto(`/admin/orders/${orderId}`);
    const fulfilment = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Mark collected', exact: true }) });
    await fulfilment.getByLabel('Reason for this change').fill('Local test handover completed');
    await fulfilment.getByRole('button', { name: 'Mark collected', exact: true }).click();
    await expect(fulfilment.getByRole('status')).toContainText('Fulfilment completed');
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('COLLECTED');
    await page.getByLabel('Note (administrator only)').fill('Internal browser test note');
    await page.getByRole('button', { name: 'Add internal note' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Internal note added' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('admin-order.png'), fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Prepare WhatsApp confirmation', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'WhatsApp confirmation', exact: true }),
    ).toBeVisible();
    const draftId = new URL(page.url()).pathname.split('/').pop()!;
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'same-origin');
    expect((await db.manualCommunication.findUniqueOrThrow({ where: { id: draftId } })).state).toBe(
      'PREPARED',
    );
    // Inspect the real authenticated POST without following its external redirect.
    await page.context().route('**/admin/communications/whatsapp/open', async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      expect(response.status()).toBe(303);
      const destination = new URL(response.headers().location!);
      expect(destination.origin).toBe('https://wa.me');
      expect(destination.searchParams.get('text')).toContain(orderId);
      expect(response.headers()['referrer-policy']).toBe('no-referrer');
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>Local test interception</title><p>WhatsApp handoff intercepted.</p>',
      });
    });
    const popupPromise = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'Open WhatsApp draft in a new tab' }).click();
    const popup = await popupPromise;
    await expect(popup.getByText('WhatsApp handoff intercepted.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin/communications/whatsapp/${draftId}$`));
    await expect
      .poll(
        async () =>
          (await db.manualCommunication.findUniqueOrThrow({ where: { id: draftId } })).state,
      )
      .toBe('OPENED');
    await popup.close();
    await page.reload();
    await page.getByLabel('I personally sent this exact message in WhatsApp').check();
    await page
      .getByLabel('Reason for this change')
      .fill('Local test attestation; no external message');
    await page.getByRole('button', { name: 'Mark manually sent', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Manual sending recorded' }),
    ).toBeVisible();
    expect((await db.manualCommunication.findUniqueOrThrow({ where: { id: draftId } })).state).toBe(
      'MARKED_SENT',
    );
    await page.screenshot({
      path: testInfo.outputPath('whatsapp-confirmation.png'),
      fullPage: true,
    });
    await page.goto('/admin/notifications');
    const notification = page
      .locator('article')
      .filter({ has: page.getByRole('link', { name: `Order ${orderId}`, exact: true }) })
      .first();
    await expect(notification).toBeVisible();
    await notification.getByRole('button', { name: 'Mark read', exact: true }).click();
    await expect(notification).toContainText('Acknowledged');
    await page.goto('/admin/communications');
    await page.getByRole('button', { name: 'Capture next 10 queued emails locally' }).click();
    const email = await db.emailMessage.findFirstOrThrow({
      where: { orderId, kind: 'ORDER_RECEIVED', audience: 'CUSTOMER' },
    });
    await expect
      .poll(
        async () => (await db.emailMessage.findUniqueOrThrow({ where: { id: email.id } })).status,
      )
      .toBe('CAPTURED');
    await page.goto(`/admin/communications/email/${email.id}`);
    await expect(page.getByText('Captured locally; not sent', { exact: false })).toBeVisible();
    expect((await page.reload())?.headers()['cache-control']).toContain('no-store');
    await page.getByLabel('I reviewed the history and want an additional copy').check();
    await page.getByRole('button', { name: 'Queue another copy', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Additional copy queued' }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download Excel workbook', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^sd-reports-.*\.xlsx$/);
    const file = testInfo.outputPath('admin-reports.xlsx');
    await download.saveAs(file);
    expect(readFileSync(file).subarray(0, 2).toString()).toBe('PK');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath('admin-reports.png'), fullPage: true });
    await page.goto(`/admin/orders/${orderId}`);
    await page.getByRole('link', { name: 'Customer profile', exact: true }).click();
    await expect(page.getByRole('link', { name: orderId })).toBeVisible();
    await page.goto('/admin/audit-logs');
    await expect(
      page.getByRole('heading', { name: 'COMPLETE ORDER', exact: true }).first(),
    ).toBeVisible();
    await page.goto(`/admin/payments/${payment.id}`);
    const refund = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Request refund', exact: true }) });
    await refund.getByLabel('Refund amount (ZAR, two decimals)').fill(payment.expected.toFixed(2));
    await refund.getByLabel('Refund reason').fill('Local test refund requested');
    await refund.getByRole('button', { name: 'Request refund', exact: true }).click();
    await expect(refund.getByRole('status')).toContainText('No money has been returned');
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).refunded.toFixed(2),
    ).toBe('0.00');
    const complete = page.locator('form').filter({
      has: page.getByRole('button', { name: 'Record externally completed refund', exact: true }),
    });
    await complete.getByLabel('External refund reference').fill(`refund-${randomUUID()}`);
    await complete.getByLabel('Completion evidence').fill('Local test external completion fixture');
    await complete.getByLabel(/I verified the refund completed externally/).check();
    await complete
      .getByRole('button', { name: 'Record externally completed refund', exact: true })
      .click();
    await expect(page.getByText('REFUNDED', { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await db.$disconnect();
    await page.goto('/account/security');
    await page.getByRole('button', { name: 'Sign out everywhere' }).click();
    await page.getByLabel('Email address').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/mfa$/);
    await page.goto('/account/addresses');
    await expect(page).toHaveURL(/\/auth\/mfa$/);
    expect((await page.goto('/admin'))?.status()).toBe(404);
  });
});

test('account forms are accessible and fit a narrow viewport', async ({ page }, testInfo) => {
  for (const route of ['/auth/sign-in', '/auth/register', '/auth/forgot-password']) {
    await page.goto(route);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/auth/sign-in');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('sign-in.png'), fullPage: true });
});
