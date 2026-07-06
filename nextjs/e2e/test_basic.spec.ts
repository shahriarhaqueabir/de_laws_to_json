import { test, expect } from '@playwright/test';

test('Basic navigation and search', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.screenshot({ path: 'test_home.png' });
  console.log('Navigated to home');

  const searchInput = page.getByPlaceholder(/Search laws/i);
  await expect(searchInput).toBeVisible();

  await searchInput.fill('BGB 823');
  await page.keyboard.press('Enter');

  await page.waitForURL(/\/search\?q=BGB\+823/);
  await page.screenshot({ path: 'test_search_results.png' });
  console.log('Search results loaded');
});
