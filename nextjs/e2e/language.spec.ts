import { test, expect } from "@playwright/test";

test.describe("Language persistence — Cookie-based hydration", () => {
  test("Language persists across refreshes via cookie", async ({ page, context }) => {
    // 1. Start on home
    await page.goto("/");

    // 2. Set language to English via cookie (simulating user preference)
    await context.addCookies([{
      name: 'glv_lang',
      value: 'en',
      domain: 'localhost',
      path: '/'
    }]);

    // 3. Reload and verify <html> attribute
    await page.reload();
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe('en');

    // 4. Set language to German via cookie
    await context.addCookies([{
      name: 'glv_lang',
      value: 'de',
      domain: 'localhost',
      path: '/'
    }]);

    await page.reload();
    const htmlLangDe = await page.getAttribute('html', 'lang');
    expect(htmlLangDe).toBe('de');
  });

  test("RTL direction is applied for Arabic", async ({ page, context }) => {
    await context.addCookies([{
      name: 'glv_lang',
      value: 'ar',
      domain: 'localhost',
      path: '/'
    }]);

    await page.goto("/");
    const htmlDir = await page.getAttribute('html', 'dir');
    expect(htmlDir).toBe('rtl');
  });
});
