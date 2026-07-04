import { test, expect } from "@playwright/test";

test.describe("Smoke tests — critical paths", () => {
  test("Homepage loads with correct title and search bar", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/German Law Vault/);

    // The search input should be present
    const searchInput = page.locator('input[aria-label="Search laws"]');
    await expect(searchInput).toBeVisible();

    // The heading should mention "The Law Vault"
    await expect(
      page.locator("h1", { hasText: "The Law Vault" })
    ).toBeVisible();

    // Navigation bar should be present
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
  });

  test("Search flow — typing a query navigates to results", async ({
    page,
  }) => {
    await page.goto("/");

    const searchInput = page.locator('input[aria-label="Search laws"]');
    await searchInput.fill("Kündigung");
    await searchInput.press("Enter");

    // Should navigate to /search?q=Kündigung
    await page.waitForURL(/\/search/);

    // The search input on the results page should reflect the query
    const resultsSearch = page.locator('input[aria-label="Search laws"]');
    await expect(resultsSearch).toHaveValue(/Kündigung/i);
  });

  test("Navigation links work correctly", async ({ page }) => {
    await page.goto("/");

    // Click the Chat nav link
    await page.getByRole("link", { name: /chat/i }).first().click();
    await page.waitForURL(/\/chat/);
    await expect(page).toHaveURL(/\/chat/);

    // Navigate to Guidance
    await page.getByRole("link", { name: /guidance/i }).first().click();
    await page.waitForURL(/\/guidance/);
    await expect(page).toHaveURL(/\/guidance/);
  });
});
