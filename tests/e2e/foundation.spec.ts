import { expect, test } from '@playwright/test';

test('storefront renders without runtime errors or mobile overflow', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/S & D Fruit and Veg.*Fresh produce in Lenasia/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Freshness you');
  await expect(
    page.getByText('Online ordering coming soon', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '083 504 3385' }).first()).toHaveAttribute(
    'href',
    'tel:+27835043385',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('storefront-viewport.png'), scale: 'css' });
  await page
    .locator('.hero-section')
    .screenshot({ path: testInfo.outputPath('hero.png'), scale: 'css' });
  await page.screenshot({ path: testInfo.outputPath('storefront-light.png'), fullPage: true });
});

test('keyboard users can skip directly to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('missing pages return 404 and offer a working home link', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Return to the homepage' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Freshness you');
});

test('preview sends protective headers and blocks search indexing', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response.headers()['x-powered-by']).toBeUndefined();
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
});
