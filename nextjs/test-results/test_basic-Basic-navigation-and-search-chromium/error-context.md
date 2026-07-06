# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test_basic.spec.ts >> Basic navigation and search
- Location: e2e\test_basic.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder(/Search laws/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByPlaceholder(/Search laws/i)

```

```yaml
- link "Skip to content":
  - /url: "#main-content"
- paragraph: 🏛 Set up your AI advisor and language in 2 minutes
- button "Start Setup"
- button "Maybe Later"
- navigation "Main navigation":
  - link "Vault":
    - /url: /
  - link "Search":
    - /url: /
  - link "Chat":
    - /url: /chat
  - link "Guidance":
    - /url: /guidance
  - link "Bookmarks":
    - /url: /bookmarks
  - link "Sign In":
    - /url: /auth
  - button "en"
  - button "Basic"
- main:
  - paragraph: “Justice delayed is justice denied.” - William E. Gladstone
  - paragraph: Bundesrepublik Deutschland
  - heading "The Law Vault" [level=1]
  - paragraph: A comprehensive repository of over 6,000 German federal statutes.
  - button "Statute Search"
  - button "AI Analysis"
  - textbox "Search laws":
    - /placeholder: Search statutes by keyword or section number...
  - button "Submit"
  - paragraph: Use law keys (e.g., 'BGB'), section numbers (§), or keywords for direct results.
  - link "Basic Search Search 6,000+ laws and read excerpts directly. No AI — you interpret the results. Get Started":
    - /url: /search
    - heading "Basic Search" [level=3]
    - paragraph: Search 6,000+ laws and read excerpts directly. No AI — you interpret the results.
    - text: Get Started
  - link "Browser AI AI runs entirely in your browser via Qwen3. Fully private, no server calls. ~1GB download. Get Started":
    - /url: /chat
    - heading "Browser AI" [level=3]
    - paragraph: AI runs entirely in your browser via Qwen3. Fully private, no server calls. ~1GB download.
    - text: Get Started
  - link "Cloud AI Bring your own OpenAI/Anthropic key. Best quality, fastest response. You control billing. Get Started":
    - /url: /settings
    - heading "Cloud AI" [level=3]
    - paragraph: Bring your own OpenAI/Anthropic key. Best quality, fastest response. You control billing.
    - text: Get Started
  - link "Local AI Connect to Ollama on your machine via the local broker. Fully offline, no data leaves your network. Get Started":
    - /url: /settings
    - heading "Local AI" [level=3]
    - paragraph: Connect to Ollama on your machine via the local broker. Fully offline, no data leaves your network.
    - text: Get Started
  - heading "Categories" [level=2]
  - link "Housing & Rent Wohnen & Miete":
    - /url: /search?category=housing
    - heading "Housing & Rent" [level=3]
    - paragraph: Wohnen & Miete
  - link "Labor & Career Arbeit & Beruf":
    - /url: /search?category=labor
    - heading "Labor & Career" [level=3]
    - paragraph: Arbeit & Beruf
  - link "Consumer Rights Einkaufen & Verträge":
    - /url: /search?category=consumer
    - heading "Consumer Rights" [level=3]
    - paragraph: Einkaufen & Verträge
  - link "Traffic & Transport Verkehr & Transport":
    - /url: /search?category=traffic
    - heading "Traffic & Transport" [level=3]
    - paragraph: Verkehr & Transport
  - link "Family & Life Familie & Leben":
    - /url: /search?category=family
    - heading "Family & Life" [level=3]
    - paragraph: Familie & Leben
  - link "Criminal Law Strafrecht":
    - /url: /search?category=criminal
    - heading "Criminal Law" [level=3]
    - paragraph: Strafrecht
  - link "Taxes & Finance Steuern & Finanzen":
    - /url: /search?category=finance
    - heading "Taxes & Finance" [level=3]
    - paragraph: Steuern & Finanzen
  - link "Health & Social Gesundheit & Soziales":
    - /url: /search?category=social
    - heading "Health & Social" [level=3]
    - paragraph: Gesundheit & Soziales
  - link "Public & Rights Staat & Rechte":
    - /url: /search?category=public
    - heading "Public & Rights" [level=3]
    - paragraph: Staat & Rechte
  - link "Tech & Environment Innovation & Umwelt":
    - /url: /search?category=tech
    - heading "Tech & Environment" [level=3]
    - paragraph: Innovation & Umwelt
  - link "Berlin Specific Berlin":
    - /url: /search?category=berlin
    - heading "Berlin Specific" [level=3]
    - paragraph: Berlin
  - link "Other Sonstiges":
    - /url: /search?category=other
    - heading "Other" [level=3]
    - paragraph: Sonstiges
- contentinfo:
  - text: Sub lege libertas
  - link "API Docs":
    - /url: /api-docs
  - text: © 2026 German Law Vault — Official Legal Intelligence Repository
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Basic navigation and search', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000');
  5  |   await page.screenshot({ path: 'test_home.png' });
  6  |   console.log('Navigated to home');
  7  | 
  8  |   const searchInput = page.getByPlaceholder(/Search laws/i);
> 9  |   await expect(searchInput).toBeVisible();
     |                             ^ Error: expect(locator).toBeVisible() failed
  10 | 
  11 |   await searchInput.fill('BGB 823');
  12 |   await page.keyboard.press('Enter');
  13 | 
  14 |   await page.waitForURL(/\/search\?q=BGB\+823/);
  15 |   await page.screenshot({ path: 'test_search_results.png' });
  16 |   console.log('Search results loaded');
  17 | });
  18 | 
```