import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp, startMatch } from "./helpers";

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
  await startMatch(page);
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

  test("reglene står på siden, og en kveld kan slettes", async ({ page }) => {
    await openApp(page, "dark");
    await playMatch(page);
    await page.getByRole("button", { name: "Til forsiden" }).click();
    await page.getByRole("link", { name: /Kveldsscore/ }).click();
    await expect(page.getByRole("list", { name: "Tabell" }).getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "Regler for Kveldsscore" }).click();
    const rules = page.getByRole("dialog", { name: "Regler for Kveldsscore" });
    await expect(rules).toContainText("begge på laget ett poeng hver");
    await expect(rules).toContainText("3, 2 og 1 poeng");
    await rules.getByRole("button", { name: "Lukk" }).last().click();
    // Deleting the evening takes the matches with it, after a question.
    await page.getByRole("button", { name: "Slett kvelden" }).click();
    await expect(page.getByRole("alertdialog").or(page.getByRole("dialog")).getByText(/Slette kvelden med 1 kamp/)).toBeVisible();
    await page.getByRole("button", { name: "Behold" }).click();
    await expect(page.getByRole("list", { name: "Tabell" })).toBeVisible();
    await page.getByRole("button", { name: "Slett kvelden" }).click();
    await page.getByRole("button", { name: "Slett kvelden" }).first().click();
    await expect(page.getByText("Ingen kamper i kveld ennå")).toBeVisible();
    await expect(page.getByRole("list", { name: "Tabell" })).toHaveCount(0);
  });

  test("kampene står også på spillerens egen side", async ({ page }) => {
    await openApp(page, "dark");
    await playMatch(page);
    await page.getByRole("button", { name: "Til forsiden" }).click();
    await page.getByRole("link", { name: "Spillere" }).click();
    await page.getByRole("link", { name: /Lars/ }).first().click();
    const list = page.getByRole("list", { name: "Kamper i Kveldsscore" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText("Lars vs. Vadla");
    await expect(list).toContainText("Vant");
    await expect(page.getByText("1–0 · 1 poeng")).toBeVisible();
  });

  test("Sammenlign viser hvem som har slått hvem", async ({ page }) => {
    await openApp(page, "dark");
    await playMatch(page);
    await page.getByRole("button", { name: "Til forsiden" }).click();
    await page.getByRole("link", { name: /Kveldsscore/ }).click();
    await page.getByRole("radio", { name: "Sammenlign" }).click();
    const grid = page.getByRole("table", { name: "Mot hverandre" });
    await expect(grid.locator("tbody tr").filter({ hasText: /^Lars/ })).toContainText("1–0");
    await expect(grid.locator("tbody tr").filter({ hasText: /^Vadla/ })).toContainText("0–1");
  });

  test("Statistikk viser utmerkelser og tall for kvelden", async ({ page }) => {
    await openApp(page, "dark");
    await playMatch(page);
    await page.getByRole("button", { name: "Til forsiden" }).click();
    await page.getByRole("link", { name: /Kveldsscore/ }).click();
    await page.getByRole("radio", { name: "Statistikk" }).click();
    const awards = page.getByRole("list", { name: "Utmerkelser" });
    await expect(awards.getByRole("listitem").filter({ hasText: "Best totalt" })).toContainText("Lars");
    await expect(awards.getByRole("listitem").filter({ hasText: "Flest 180" })).toContainText("Lars");
    await expect(awards.getByRole("listitem").filter({ hasText: "Beste runde" })).toContainText("180");
    await expect(awards.getByRole("listitem").filter({ hasText: "Beste utsjekk" })).toContainText("121");
    await page.screenshot({ path: "test-results/kveldsstatistikk.png", fullPage: true });
    // One person's evening opens from the name, and two can be set against each other.
    await awards.getByRole("button", { name: "Lars" }).first().click();
    await expect(page.getByRole("dialog", { name: "Lars i kveld" })).toContainText("1–0");
    await page.getByRole("dialog", { name: "Lars i kveld" }).getByRole("button", { name: "Lukk" }).last().click();
    const cmp = page.getByRole("table", { name: "Sammenligning" });
    await expect(cmp).toContainText("Dueller mot hverandre");
    await expect(cmp).toContainText("Beste runde");
  });
});
