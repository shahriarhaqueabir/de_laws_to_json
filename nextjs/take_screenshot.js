const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.screenshot({ path: 'home_manual.png' });
  console.log('Screenshot taken: home_manual.png');
  await browser.close();
})();
