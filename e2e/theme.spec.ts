import { expect, test } from "@playwright/test";

/**
 * Auto: with no choice made the page follows the phone, before anything is drawn, and follows it when it changes. A choice of Mørk or
 * Dag wins over the phone. The keypad is in the way of the app, not of the theme, so none of this needs the code.
 */
test.describe("tema", () => {
  const theme = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.dataset.theme ?? "dark");

  test("følger telefonen når ingenting er valgt", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await theme(page)).toBe("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => theme(page)).toBe("dark");
  });

  test("et valg slår telefonen", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mikke-mus-theme", "dark"));
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await theme(page)).toBe("dark");
  });
});
