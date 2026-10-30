import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** The bots in 301 / 501, Highstriker and Lava: they are picked like in the other games, and throw by themselves when it is their turn. */
async function begin(page: Page, game: "301 / 501" | "Highstriker" | "Lava") {
  // The fastest bots, so the test does not wait for them.
  await page.addInitScript(() => localStorage.setItem("mikke-mus-bot-speed", "instant"));
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: game }).click();
  await page.getByRole("button", { name: "Ny spiller" }).click();
  await page.getByPlaceholder("Spillernavn").fill("Lars");
  await page.getByRole("button", { name: "Legg til" }).click();
  await page.getByRole("button", { name: "Bot", exact: true }).click();
  await page.locator("div.grid-cols-3 button").first().click();
  if (game === "301 / 501") await page.getByRole("radio", { name: "301" }).click();
}
const start = (page: Page) => page.getByRole("button", { name: "Start kampen" }).click();
const keys = async (page: Page, digits: string) => {
  for (const d of digits) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
};
const card = (page: Page, name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });

test.describe("boter i de andre spillene", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("en bot alene er ikke nok: det må være minst én spiller", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mikke-mus-bot-speed", "instant"));
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Andre spill" }).click();
    await page.getByRole("button", { name: "301 / 501" }).click();
    await page.getByRole("button", { name: "Bot", exact: true }).click();
    await page.locator("div.grid-cols-3 button").first().click();
    await expect(page.getByText("Velg minst én spiller")).toBeVisible();
  });

  test("301: boten kaster runden sin selv, og angre tar den med", async ({ page }) => {
    await begin(page, "301 / 501");
    await start(page);
    await keys(page, "60");
    await expect(card(page, "Lars")).toContainText("241");
    // The bot's round comes by itself, with its darts shown, and the turn is Lars's again.
    await expect(page.getByRole("status")).toContainText(/Littler: .*(=|over|tar ut)/);
    await expect(card(page, "Lars")).toHaveAttribute("aria-current", "true");
    // Taking back takes the bot's round and Lars's own.
    // Angre is a button of its own at the top of the board now; the key in the keypad only takes a digit back.
    await page.getByRole("button", { name: "Angre siste runde" }).click();
    await expect(card(page, "Lars")).toContainText("301");
    await expect(card(page, "Littler")).toContainText("301");
    await expect(card(page, "Lars")).toHaveAttribute("aria-current", "true");
  });

  test("Highstriker: boten må slå runden før og kaster selv", async ({ page }) => {
    await begin(page, "Highstriker");
    await start(page);
    await keys(page, "60");
    await expect(page.getByText(/Littler: .* = \d+/)).toBeVisible();
    await expect(card(page, "Lars")).toHaveAttribute("aria-current", "true");
  });

  test("Lava: boten kaster tre piler selv, og feltene den treffer brenner", async ({ page }) => {
    await begin(page, "Lava");
    await start(page);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Bom" }).click();
    await expect(page.getByRole("status")).toContainText(/Littler:/);
    await expect(card(page, "Lars")).toHaveAttribute("aria-current", "true");
    await expect(page.getByText(/felt er trygge/)).not.toContainText("21 felt er trygge");
  });
});
