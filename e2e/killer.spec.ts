import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Killer: et tall hver, tre treff på det for å bli killer, og så tar killeren liv fra de andre. */
async function begin(page: Page) {
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: "Killer" }).click();
  for (const name of ["Lars", "Vadla"]) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  await page.getByRole("button", { name: "Start kampen" }).click();
}
const board = (page: Page) => page.getByRole("group", { name: /Brettet/ });
const status = (page: Page) => page.getByRole("status");
const side = (page: Page, name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });

test.describe("Killer", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("tall hver, tre treff gjør deg til killer, og killeren tar livene fra den andre", async ({ page }) => {
    await begin(page);
    await expect(status(page)).toContainText("Lars kaster én pil for å få et tall");
    await board(page).getByRole("button", { name: "20", exact: true }).first().click();
    await expect(side(page, "Lars")).toContainText("20");
    // A number that is taken cannot be chosen again: it is gone from the board, and Vadla gets 19.
    await board(page).getByRole("button", { name: "19", exact: true }).first().click();
    await expect(side(page, "Vadla")).toContainText("19");
    // Lars hits the treble of his own number: three hits, a killer.
    await board(page).getByRole("button", { name: "T20", exact: true }).click();
    await expect(status(page)).toContainText("Lars er killer!");
    await expect(side(page, "Lars")).toContainText("KILLER");
    // And then the treble of Vadla's number takes all three of her lives, which is the end of her.
    await board(page).getByRole("button", { name: "T19", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Lars" })).toBeVisible();
    await expect(page.getByText("Vinner · Killer")).toBeVisible();
  });

  test("Bom kaster på nytt i første del, og Angre tar pila tilbake", async ({ page }) => {
    await begin(page);
    await page.getByRole("button", { name: "Bom", exact: true }).click();
    await expect(status(page)).toContainText("Lars kaster på nytt");
    await board(page).getByRole("button", { name: "7", exact: true }).first().click();
    await expect(side(page, "Lars")).toContainText("7");
    await page.getByRole("button", { name: "Angre siste pil" }).click();
    await expect(side(page, "Lars")).not.toContainText("7");
  });
});
