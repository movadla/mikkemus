import { expect, test } from "@playwright/test";
import { PIN, SCREENS, THEMES, openApp } from "./helpers";

/**
 * A picture of each main screen, in the dark theme and in Dag, with nothing from the database in it: the screens show their empty
 * states and the pictures do not change when a match is played. Run with the code of the app in E2E_PIN (the tests are skipped
 * without it): `E2E_PIN=... npm run test:visual`.
 */
test.describe("skjermbilder", () => {
  test.skip(!PIN, "E2E_PIN is not set");
  for (const theme of THEMES) {
    for (const s of SCREENS) {
      test(`${s.name} (${theme})`, async ({ page }) => {
        await openApp(page, theme);
        if (s.path !== "/") await page.goto(s.path);
        await page.waitForTimeout(800);
        await expect(page).toHaveScreenshot(`${s.name}-${theme}.png`, { fullPage: false });
      });
    }

    test(`oppsett av turnering (${theme})`, async ({ page }) => {
      await openApp(page, theme);
      await page.getByRole("button", { name: "Turnering" }).first().click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`turnering-oppsett-${theme}.png`);
    });

    test(`oppsett av enkeltkamp (${theme})`, async ({ page }) => {
      await openApp(page, theme);
      await page.getByRole("button", { name: "Ny kamp" }).click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`enkeltkamp-oppsett-${theme}.png`);
    });

    test(`velkomst (${theme})`, async ({ page }) => {
      await openApp(page, theme, { welcomed: false });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`velkomst-${theme}.png`);
    });
  }
});
