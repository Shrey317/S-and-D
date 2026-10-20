import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('theme follows the system, persists overrides and applies before first paint', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Choose colour theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.addInitScript(() => {
    // An initial animation callback can run while streamed HTML has not painted yet.
    // Preserve the class timeline so later hydration cannot conceal a wrong first paint.
    const themes = [{ time: performance.now(), theme: document.documentElement?.className || '' }];
    const mutations = new MutationObserver(() => {
      const theme = document.documentElement?.className || '';
      if (themes.at(-1)?.theme !== theme) themes.push({ time: performance.now(), theme });
    });
    mutations.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    const paints = new PerformanceObserver((list) => {
      const firstPaint = list.getEntries().find((entry) => entry.name === 'first-paint');
      if (!firstPaint) return;
      document.documentElement.dataset.firstTheme =
        themes.filter((entry) => entry.time <= firstPaint.startTime).at(-1)?.theme || '';
      mutations.disconnect();
      paints.disconnect();
    });
    paints.observe({ type: 'paint', buffered: true });
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-first-theme', /light/);
  await page.getByRole('button', { name: 'Choose colour theme' }).click();
  await page.getByRole('menuitemradio', { name: 'System', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-first-theme', /dark/);
  await page.screenshot({ path: testInfo.outputPath('storefront-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveClass(/light/);
});

test('basket drawer traps focus, closes on Escape and restores its trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open basket', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Your basket' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'View basket' })).toHaveAttribute('href', '/cart');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('navigation reaches informational pages on each viewport', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: 'Contact' })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  } else {
    await page.getByRole('link', { name: 'Your account', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.getByRole('button', { name: 'Browse categories' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Fruits', exact: true }).click();
    await expect(page).toHaveURL(/category=fruits/);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Contact' })
      .click();
  }
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByLabel('Your name')).toBeVisible();
});

test('copy address reports actual clipboard success and failure', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Copy address' }).click();
  await expect(page.getByText('Shop address copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('155 Gemsbok Street');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () => Promise.reject(new Error('Permission denied')),
    });
  });
  await page.getByRole('button', { name: 'Copy address' }).click();
  await expect(page.getByText(/Could not copy the address/)).toBeVisible();
});

test('category selection survives reload and invalid values recover safely', async ({ page }) => {
  await page.goto('/shop');
  await page
    .getByRole('navigation', { name: 'Category filters' })
    .getByRole('link', { name: 'Vegetables', exact: true })
    .click();
  await expect(page).toHaveURL(/category=vegetables/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vegetables');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vegetables');
  await expect(page.getByRole('region', { name: 'Product results' })).toContainText('10 products');
  await page.goto('/shop?category=unknown');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore the shop');
});

test('enquiry stays a local draft with an explicit WhatsApp handoff', async ({ page }) => {
  await page.goto('/contact');
  const outbound: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' || request.url().includes('wa.me'))
      outbound.push(request.url());
  });
  await page.getByLabel('Your name').fill('Asha');
  await page.getByLabel('Your message', { exact: true }).fill('Do you have apples & pears?');
  await page.getByRole('button', { name: 'Prepare WhatsApp enquiry' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ready for WhatsApp' });
  await expect(dialog.getByText(/prepared, not sent/)).toBeVisible();
  const url = new URL(
    (await dialog.getByRole('link', { name: 'Open WhatsApp' }).getAttribute('href'))!,
  );
  expect(url.searchParams.get('text')).toContain('apples & pears?');
  expect(outbound).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Prepare WhatsApp enquiry' })).toBeFocused();
});

test('light and dark storefront and contact pass automated accessibility checks', async ({
  page,
}) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const path of ['/', '/contact']) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
      ).toBe('auto');
    }
  }
});

test('all linked public routes resolve and small screens do not overflow', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const hrefs = await page
    .locator('a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')!))]);
  for (const href of hrefs) expect((await request.get(href)).status()).toBe(200);
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of [
    '/',
    '/shop',
    '/about',
    '/contact',
    '/delivery-and-collection',
    '/policies',
    '/image-credits',
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
});
