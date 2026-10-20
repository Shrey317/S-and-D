import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.setTimeout(60000);

test('fresh CSP nonces block injected scripts and preserve interactive navigation', async ({
  page,
  request,
}) => {
  const a = await request.get('/'),
    b = await request.get('/');
  const policy = a.headers()['content-security-policy']!;
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  expect(policy).not.toBe(b.headers()['content-security-policy']);
  // Inject into parsed HTML, rather than Playwright's trusted evaluation context.
  await page.route('http://127.0.0.1:3100/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        '<head>',
        '<head><script>window.__injected = true</script>',
      ),
    });
  });
  await page.goto('/');
  expect(await page.evaluate(() => !('__injected' in window))).toBe(true);
  await page.unroute('http://127.0.0.1:3100/');
  await page.goto('/shop');
  await page.getByRole('heading', { level: 1 }).waitFor();
  const search = page.getByRole('searchbox').first();
  await search.fill('apples');
  await search.press('Enter');
  await expect(page).toHaveURL(/q=apples/);
});

test('preview SEO does not publish sample offers or indexable customer routes', async ({
  page,
  request,
}) => {
  for (const path of ['/shop', '/shop/sample-apples']) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `http://127.0.0.1:3100${path}`,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBe(0);
  }
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain('<loc>');
  expect((await request.get('/admin/reports/export')).status()).toBe(404);
});

test('policy and auth pages support enlarged text and keyboard navigation', async ({ page }) => {
  for (const path of ['/policies', '/auth/sign-in', '/auth/register', '/auth/forgot-password']) {
    await page.goto(path);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 8),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `${path}: ${overflow.join(', ')}`,
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
  }
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('public pages have bounded script payloads and record lab navigation timings', async ({
  page,
}, testInfo) => {
  const results = [];
  for (const path of ['/', '/shop', '/shop/sample-apples']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      const scripts = (
        performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      ).filter((r) => r.initiatorType === 'script');
      return {
        ttfbMs: navigation.responseStart - navigation.requestStart,
        domReadyMs: navigation.domContentLoadedEventEnd,
        scriptBytes: scripts.reduce((sum, r) => sum + r.encodedBodySize, 0),
        scriptCount: scripts.length,
      };
    });
    expect(metrics.scriptBytes).toBeLessThan(1_000_000);
    results.push({ path, ...metrics });
  }
  await testInfo.attach('local-navigation-metrics', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
});
