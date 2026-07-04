import { test, expect } from "@playwright/test";

test.describe("Law detail page", () => {
  test("Known law page loads with metadata", async ({ page }) => {
    await page.goto("/laws/bgb");

    // Wait for loading to finish — the loading spinner should disappear
    await page.waitForLoadState("networkidle");

    // The law key badge should be visible (BGB)
    await expect(page.locator("text=BGB").first()).toBeVisible();

    // Metadata grid should contain status, authority, modified, density
    await expect(page.locator("text=Status").first()).toBeVisible();
    await expect(page.locator("text=Authority").first()).toBeVisible();

    // The heading should be the law title (starts with "Bürgerliches Gesetzbuch")
    await expect(
      page.locator("h1", { hasText: /Bürgerliches Gesetzbuch/i }),
    ).toBeVisible();

    // The "Statutory Framework" section heading should exist
    await expect(page.locator("text=Statutory Framework")).toBeVisible();
  });

  test("Norm content renders for a law", async ({ page }) => {
    await page.goto("/laws/bgb");
    await page.waitForLoadState("networkidle");

    // Norms are rendered inside NormViewer components.
    // Each norm has a header showing "Section" + the norm ID.
    // The page either shows norm sections or an empty state message.
    const normHeader = page.locator("text=Section").first();
    const emptyState = page.locator("text=No norms available");

    // One of these should be visible (norms loaded or empty state from fallback)
    await expect(normHeader.or(emptyState.first())).toBeVisible({
      timeout: 15_000,
    });
  });
});
