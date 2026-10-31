import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp, startMatch, startPast } from "./helpers";

/** Back from a match that has been started lands on the setup as it was, instead of an empty one. */
async function setup301(page: Page) {
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: "301 / 501" }).click();
  for (const name of ["Lars", "Vadla"]) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  await page.getByRole("radio", { name: "301" }).click();
}

test.describe("tilbake til oppsettet", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("301: tilbake før noe er kastet går rett til oppsettet med alt som før", async ({ page }) => {
    await setup301(page);
    await startMatch(page);
    await page.getByRole("button", { name: "Tilbake" }).first().click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "301" })).toBeChecked();
    await expect(page.getByText("Lars").first()).toBeVisible();
    await expect(page.getByText("Vadla").first()).toBeVisible();
  });

  test("301: etter en runde spørres det, og «Til oppsettet» gir samme oppsett", async ({ page }) => {
    await setup301(page);
    await startMatch(page);
    for (const d of "60") await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
    await page.getByRole("button", { name: "Tilbake" }).first().click();
    await page.getByRole("button", { name: "Til oppsettet" }).click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "301" })).toBeChecked();
    await expect(page.getByText("Lars").first()).toBeVisible();
  });
});

test.describe("tilbake til oppsettet i Mikke Mus", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("avslutt før noe er kastet gir oppsettet tilbake med spillerne og valgene", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Ny kamp" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("switch", { name: "Avanserte innstillinger" }).click();
    await startMatch(page);
    await startPast(page);
    await page.getByRole("button", { name: "Hjem" }).first().click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();
    await expect(page.getByText("Lars").first()).toBeVisible();
    await expect(page.getByText("Vadla").first()).toBeVisible();
    await expect(page.getByRole("switch", { name: "Avanserte innstillinger" })).toBeChecked();
  });
});
