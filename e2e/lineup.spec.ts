import { expect, test } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** The cards before the match: in Vanlig too, and Fortsett goes straight to the board, with no count down. */
test.describe("kortene før kamp", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("vanlig modus viser kortene, og Fortsett går rett til brettet", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Ny kamp" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("button", { name: /Start/ }).first().click();
    const skip = page.getByRole("button", { name: "Hopp over" });
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click();

    const cards = page.getByRole("dialog", { name: "Oppstilling" });
    await expect(cards).toBeVisible();
    await expect(cards.getByText("Lars")).toBeVisible();
    await expect(cards.getByText("Vadla")).toBeVisible();
    // Nothing counts down by itself: they stay until Fortsett.
    await page.waitForTimeout(2500);
    await expect(cards).toBeVisible();
    await cards.getByRole("button", { name: "Fortsett" }).click();
    // And then the board, with no 3, 2, 1.
    await expect(cards).toBeHidden({ timeout: 1000 });
    await expect(page.getByText("Kast!")).toHaveCount(0);
  });

  test("Enkel viser ingen kort", async ({ page }) => {
    await openApp(page, "dark");
    // Registered after the one that sets Vanlig, so it runs after it on the next load.
    await page.addInitScript(() => localStorage.setItem("mikke-mus-fx-level", "simple"));
    await page.reload();
    await page.getByRole("button", { name: "Ny kamp" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("button", { name: /Start/ }).first().click();
    const skip = page.getByRole("button", { name: "Hopp over" });
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog", { name: "Oppstilling" })).toHaveCount(0);
  });
});
