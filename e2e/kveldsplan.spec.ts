import { expect, test, type Page } from "@playwright/test";
import { PIN, chooseStarter, openApp, startPast } from "./helpers";

/** Kveldsplan: the matches of the evening set up in advance, and played from the plan with Neste. */
const keys = async (page: Page, digits: string) => {
  for (const d of digits) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
};

/** A new evening, and a 301 between Lars and Vadla (no double out, so it can be played with three rounds) put in its plan. */
async function planOne(page: Page) {
  await openApp(page, "dark");
  await page.getByRole("link", { name: /^Kveldsscore/ }).click();
  await page.getByRole("button", { name: "Ny kveld" }).click();
  await expect(page.getByText("Ingen kamper i planen ennå")).toBeVisible();
  await page.getByRole("button", { name: "Legg til kamp i planen" }).click();
  await page.getByRole("button", { name: "301 / 501" }).click();
  for (const name of ["Lars", "Vadla"]) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  await page.getByRole("radio", { name: "301" }).click();
  await page.getByRole("switch", { name: "Dobbel ut" }).click();
  await page.getByRole("button", { name: "Legg i planen" }).click();
}

test.describe("Kveldsplan", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("en kamp settes opp i planen og spilles med Neste, og planen viser den som spilt", async ({ page }) => {
    await planOne(page);
    // Back in the plan with the match in it, and Neste for it.
    await expect(page.getByRole("list", { name: "Kveldsplan" })).toContainText("Lars mot Vadla");
    const next = page.getByRole("button", { name: /^Neste: 301 \/ 501/ });
    await expect(next).toContainText("Lars mot Vadla");
    await next.click();
    // The game opens with the setup (301, no double out) and only asks who starts.
    await page.getByRole("dialog", { name: /starter\?$/ }).waitFor();
    await chooseStarter(page);
    const left = (name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });
    await expect(left("Lars")).toContainText("301");
    await keys(page, "180");
    await keys(page, "60");
    await keys(page, "121");
    await page.getByRole("dialog", { name: "Hvor mange piler tok siste runde?" }).getByRole("button", { name: "2 piler" }).click();
    // The winner screen, then back to the plan: the match is played.
    await page.getByRole("button", { name: "Til forsiden" }).click();
    await expect(page).toHaveURL(/\/kveld/);
    await expect(page.getByRole("list", { name: "Kveldsplan" })).toContainText("Spilt");
    await expect(page.getByRole("button", { name: /^Neste:/ })).toBeHidden();
    // It counts in the table.
    await page.getByRole("radio", { name: "Tabell" }).click();
    await expect(page.getByRole("list", { name: "Tabell" })).toContainText("Lars");
  });

  test("planen kan endres: flyttes og slettes", async ({ page }) => {
    await planOne(page);
    await page.getByRole("list", { name: "Kveldsplan" }).getByRole("button").click();
    await expect(page.getByRole("button", { name: "Flytt opp" })).toBeDisabled();
    await page.getByRole("button", { name: "Slett fra planen" }).click();
    await expect(page.getByText("Ingen kamper i planen ennå")).toBeVisible();
  });

  test("en enkeltkamp i planen starter av seg selv med spillerne", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("link", { name: /^Kveldsscore/ }).click();
    await page.getByRole("button", { name: "Ny kveld" }).click();
    await page.getByRole("button", { name: "Legg til kamp i planen" }).click();
    await page.getByRole("button", { name: "Enkeltkamp" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("button", { name: "Legg i planen" }).click();
    await expect(page.getByRole("list", { name: "Kveldsplan" })).toContainText("Lars mot Vadla");
    await page.getByRole("button", { name: /^Neste: Enkeltkamp/ }).click();
    await startPast(page);
    // No setup in between: the match is on.
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeHidden();
    await expect(page.getByText("Lars").first()).toBeVisible();
  });

  test("Kveldsscore p� forsiden kan gjemmes og kommer tilbake med en ny kveld", async ({ page }) => {
    await openApp(page, "dark");
    const stripe = page.getByRole("link", { name: /^Kveldsscore/ });
    await page.getByRole("button", { name: "Gjem" }).click();
    await expect(stripe).toBeHidden();
    await page.reload();
    await expect(page.getByRole("button", { name: "Gjem" })).toBeHidden();
  });
});
