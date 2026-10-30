import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Kveldsscore: kampene kommer inn av seg selv, tabellen gir ett poeng for en seier, og en kamp kan overstyres, slettes og legges inn for hånd. */
async function playMatch(page: Page) {
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: "301 / 501" }).click();
  for (const name of ["Lars", "Vadla"]) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  await page.getByRole("radio", { name: "301" }).click();
  await page.getByRole("button", { name: "Start kampen" }).click();
  const keys = async (d: string) => {
    for (const c of d) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: c, exact: true }).click();
  };
  await keys("180");
  await keys("60");
  await keys("121");
  await page.getByRole("dialog", { name: "Hvor mange piler tok siste runde?" }).getByRole("button", { name: "2 piler" }).click();
  await expect(page.getByRole("heading", { name: "Lars" })).toBeVisible();
}

test.describe("Kveldsscore", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("en ferdig kamp kommer inn, kan overstyres og slettes med Angre, og en kamp kan legges inn for hånd", async ({ page }) => {
    await openApp(page, "dark");
    await playMatch(page);
    await page.getByRole("button", { name: "Til forsiden" }).click();
    // The front page says it, and the stripe leads in.
    await page.getByRole("link", { name: /Kveldsscore: 1 kamper i kveld/ }).click();
    await expect(page.getByRole("heading", { name: "Kveldsscore" })).toBeVisible();
    const table = page.getByRole("list", { name: "Tabell" });
    await expect(table.getByRole("listitem").first()).toContainText("Lars");
    await expect(table.getByRole("listitem").first().getByLabel("1 poeng")).toBeVisible();
    // The matches, as one line each.
    await page.getByRole("radio", { name: /^Kamper/ }).click();
    const lines = page.getByRole("list", { name: "Kamper" });
    await expect(lines.getByRole("button").first()).toContainText("Lars vs. Vadla");
    await expect(lines.getByRole("button").first()).toContainText("1-0");
    // Override: Vadla won.
    await lines.getByRole("button").first().click();
    const sheet = page.getByRole("dialog", { name: "Lars vs. Vadla" });
    await sheet.getByRole("radio", { name: "Vadla" }).click();
    await expect(sheet).toContainText("Vadla får ett poeng");
    await sheet.getByRole("button", { name: "Lukk" }).first().click();
    await expect(lines.getByRole("button").first()).toContainText("0-1");
    await expect(lines.getByRole("button").first()).toContainText("Overstyrt");
    // Deleting takes it out of the evening, and Angre puts it back.
    await lines.getByRole("button").first().click();
    await page.getByRole("dialog", { name: "Lars vs. Vadla" }).getByRole("button", { name: "Slett fra kvelden" }).click();
    await expect(page.getByText("Kampen er slettet fra kvelden")).toBeVisible();
    await page.getByRole("button", { name: "Angre" }).click();
    await expect(lines.getByRole("button").first()).not.toContainText("Slettet");
    // A match written in by hand.
    await page.getByRole("button", { name: "Legg til en kamp" }).click();
    const add = page.getByRole("dialog", { name: "Legg til en kamp" });
    for (const name of ["Hans", "Erlend"]) {
      await add.getByRole("button", { name: "Ny spiller" }).click();
      await add.getByPlaceholder("Spillernavn").fill(name);
      await add.getByRole("button", { name: "Legg til", exact: true }).first().click();
    }
    await add.getByRole("radio", { name: "Hans" }).click();
    await add.getByRole("button", { name: "Legg til", exact: true }).last().click();
    await expect(lines.getByRole("button").first()).toContainText("Hans vs. Erlend");
    await expect(lines.getByRole("button").first()).toContainText("Manuell");
  });
});
