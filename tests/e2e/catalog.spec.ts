import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('database catalog search, filters and pagination persist in the URL', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/shop');
  await expect(page.getByRole('region', { name: 'Product results' })).toContainText('30 products');
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('region', { name: 'Product results' })).toContainText('Page 2');
  await page.getByLabel('Search products').fill('tomatoes');
  await expect(page).toHaveURL(/q=tomatoes/);
  await expect(page.getByRole('region', { name: 'Product results' })).toContainText('1 products');
  await expect(page).not.toHaveURL(/page=2/);
  await page.reload();
  await expect(page.getByLabel('Search products')).toHaveValue('tomatoes');
  await page.goto('/shop');
  if (isMobile) await page.getByRole('button', { name: 'Filters & sort' }).click();
  const panel = isMobile
    ? page.getByRole('dialog')
    : page.getByRole('complementary', { name: 'Product filters' });
  await panel.getByLabel('Category', { exact: true }).selectOption('vegetables');
  await panel.getByLabel('Minimum', { exact: true }).fill('40');
  await panel.getByLabel('Availability', { exact: true }).selectOption('in-stock');
  await panel.getByLabel('Sort by', { exact: true }).selectOption('price-desc');
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/category=vegetables/);
  await expect(page).toHaveURL(/min=40/);
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page.getByRole('region', { name: 'Product results' })).toContainText('3 products');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('catalog.png'), fullPage: true, scale: 'css' });
});

test('distinct variants display current price, availability and basket controls', async ({
  page,
}, testInfo) => {
  await page.goto('/shop/sample-apples');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Apples');
  await expect(page.getByTestId('variant-price')).toHaveText('R5.50');
  await page.getByRole('radio', { name: '1 kg pack' }).check();
  await expect(page.getByTestId('variant-price')).toHaveText('R12.50');
  await expect(page.getByRole('button', { name: 'Add to basket', exact: true })).toBeEnabled();
  await page.getByLabel('Quantity').fill('999');
  await expect(page.getByLabel('Quantity')).toHaveValue('10');
  await page.screenshot({ path: testInfo.outputPath('product.png'), fullPage: true, scale: 'css' });
  await page.goto('/shop/sample-pineapples');
  await expect(page.getByText('Out of stock', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Quantity')).toBeDisabled();
  const response = await page.goto('/shop/does-not-exist');
  expect(response?.status()).toBe(404);
});

test('empty, popular and invalid filters are explicit and recoverable', async ({ page }) => {
  await page.goto('/shop?q=nonexistent');
  await expect(
    page.getByRole('heading', { name: 'No products match these filters' }),
  ).toBeVisible();
  await page.goto('/shop?selection=popular');
  await expect(
    page.getByRole('heading', { name: 'Customer favourites are still to come' }),
  ).toBeVisible();
  await page.goto('/shop?min=999&max=1&sort=invalid&page=-1');
  await expect(page.getByRole('region', { name: 'Product results' })).toContainText('30 products');
});

test('catalog and product remain accessible in both themes', async ({ page, isMobile }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const path of ['/shop', '/shop/sample-apples']) {
      await page.goto(path);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.setViewportSize({ width: 320, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (path === '/shop' && isMobile) {
        await page.getByRole('button', { name: 'Filters & sort' }).click();
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Filters & sort' })).toBeFocused();
      }
    }
  }
});
