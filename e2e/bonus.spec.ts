import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Ekstrapoeng i Kveldsscore for 180, tre i bull og utsjekk på 100 eller mer, valgt under Avanserte innstillinger. */
const keys = async (page: Page, d: string) => {
  for (const c of d) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: c, exact: true }).click();
};

test.describe("ekstrapoeng", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("301: 180, tre bull (spørsmål ved 150) og utsjekk 100+ gir poeng i Kveldsscore", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Andre spill" }).click();
    await page.getByRole("button", { name: "301 / 501" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("radio", { name: "301" }).click();
    await page.getByRole("switch", { name: /Avanserte innstillinger/ }).click();
    for (const label of ["180", "Tre i bull", "Utsjekk på 100 eller mer"]) await page.getByRole("switch", { name: new RegExp(`^${label}`) }).click();
    await page.getByRole("button", { name: "Start kampen" }).click();
    // 180 by Lars, then Vadla 150: asked whether it was three bulls.
    await keys(page, "180");
    await keys(page, "150");
    const ask = page.getByRole("dialog", { name: "Tre i bull?" });
    await expect(ask).toContainText("Vadla kastet 150");
    await ask.getByRole("button", { name: "Ja, tre bull" }).click();
    // Lars has 121 left: 121 finishes it (a checkout of 100 or more).
    await keys(page, "121");
    await page.getByRole("dialog", { name: "Hvor mange piler tok siste runde?" }).getByRole("button", { name: "2 piler" }).click();
    await page.getByRole("button", { name: "Til forsiden" }).click();
    await page.getByRole("link", { name: /Kveldsscore/ }).click();
    // Lars: 1 for the win, 1 for the 180, 1 for the checkout. Vadla: 1 for the three bulls.
    const table = page.getByRole("list", { name: "Tabell" });
    await expect(table.getByRole("listitem").first()).toContainText("Lars");
    await expect(table.getByRole("listitem").first().getByLabel("3 poeng")).toBeVisible();
    await expect(table.getByRole("listitem").first()).toContainText("+2 bonus");
    await expect(table.getByRole("listitem").nth(1)).toContainText("Vadla");
    await expect(table.getByRole("listitem").nth(1).getByLabel("1 poeng")).toBeVisible();
    await page.getByRole("radio", { name: /^Kamper/ }).click();
    await page.getByRole("list", { name: "Kamper" }).getByRole("button").first().click();
    await expect(page.getByRole("dialog", { name: "Lars vs. Vadla" })).toContainText("Ekstrapoeng: Lars: 180, Vadla: tre i bull, Lars: utsjekk 100+");
  });
});
