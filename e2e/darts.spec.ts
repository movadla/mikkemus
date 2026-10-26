import { expect, test } from "@playwright/test";
import { PIN, openApp, startPast } from "./helpers";

/** Keying in the darts by hand: a dart keyed in wrongly can be tapped and keyed in again, from the sheet itself. */
test.describe("legg inn piler for hånd", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("en pil som er lagt inn feil kan rettes fra arket", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Ny kamp" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByLabel("Avanserte innstillinger").check();
    await page.getByLabel(/Legg inn hver pil for hånd/).check();
    await page.getByRole("button", { name: /Start/ }).first().click();
    await startPast(page);

    await page.getByRole("button", { name: "Legg inn pil 1" }).click();
    const sheet = page.getByRole("dialog", { name: "Legg inn pil 2" });
    // The first dart was keyed in as a miss, and the sheet has moved on to the second.
    await page.getByRole("dialog", { name: "Legg inn pil 1" }).getByRole("button", { name: "Bom" }).click();
    await expect(sheet).toBeVisible();
    // Tapping it opens the dart to be changed, and a different one is chosen.
    await sheet.getByRole("button", { name: /^Endre pil 1/ }).click();
    const fix = page.getByRole("dialog", { name: "Rett pil 1" });
    await expect(fix).toBeVisible();
    await fix.getByRole("button", { name: "Dobbel", exact: true }).click();
    await fix.getByRole("button", { name: "Dobbel 19" }).click();
    // Back in the sheet, with the corrected dart in its place.
    await expect(page.getByRole("dialog", { name: "Legg inn pil 2" }).getByRole("button", { name: "Endre pil 1: D19" })).toBeVisible();
  });
});
