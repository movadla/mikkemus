import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PIN, THEMES, openApp } from "./helpers";

/** Highstriker: every round has to beat the one before, and a life goes when it does not. */
async function begin(page: Page, theme: "dark" | "light", lives?: number, players = ["Lars", "Vadla"]) {
  await openApp(page, theme);
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: "Highstriker" }).click();
  for (const name of players) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  if (lives !== undefined) {
    await page.getByRole("switch", { name: /Avanserte innstillinger/ }).click();
    for (let n = 3; n > lives; n--) await page.getByRole("button", { name: "Ett liv mindre" }).click();
    for (let n = 3; n < lives; n++) await page.getByRole("button", { name: "Ett liv mer" }).click();
  }
  await page.getByRole("button", { name: "Start kampen" }).click();
}
const keys = async (page: Page, digits: string) => {
  for (const d of digits) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
};
const card = (page: Page, name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });

test.describe("highstriker", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  for (const theme of THEMES) {
    test(`sier hva runden må være, og tar et liv når den ikke holder (${theme})`, async ({ page }) => {
      await begin(page, theme);
      await expect(page.getByText("Sett standarden")).toBeVisible();
      await keys(page, "60");
      // Vadla has to beat 60: at least 61.
      await expect(page.getByText("VADLA MÅ HA MINST")).toBeVisible();
      await expect(page.getByText("61", { exact: true })).toBeVisible();
      await keys(page, "5");
      await expect(page.getByText("5 er for lite")).toBeVisible();
      await keys(page, "0");
      // 50 goes in by itself and is not enough: a life is gone.
      await expect(card(page, "Vadla").getByRole("img")).toHaveAttribute("aria-label", "2 av 3 liv igjen");
      await expect(card(page, "Lars").getByRole("img")).toHaveAttribute("aria-label", "3 av 3 liv igjen");
      // Lars has to beat 50.
      await keys(page, "70");
      await expect(card(page, "Lars").getByRole("img")).toHaveAttribute("aria-label", "3 av 3 liv igjen");

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }

  test("en runde som er lik den før tar et liv, og Angre gir det tilbake", async ({ page }) => {
    await begin(page, "dark");
    await keys(page, "60");
    await keys(page, "60");
    await expect(card(page, "Vadla").getByRole("img")).toHaveAttribute("aria-label", "2 av 3 liv igjen");
    await page.getByRole("button", { name: "Angre" }).click();
    await expect(card(page, "Vadla").getByRole("img")).toHaveAttribute("aria-label", "3 av 3 liv igjen");
  });

  test("antall liv kan endres, og den som er igjen vinner", async ({ page }) => {
    await begin(page, "dark", 1);
    await expect(card(page, "Lars").getByRole("img")).toHaveAttribute("aria-label", "1 av 1 liv igjen");
    await keys(page, "60");
    await keys(page, "50");
    await expect(page.getByRole("heading", { name: "Lars" })).toBeVisible();
    await expect(page.getByText("SISTE I LIVE")).toBeVisible();
    await page.screenshot({ path: "test-results/highstriker-winner.png" });
  });

  test("siste liv sies, utslåtte får stempel og tårnet stiger med det som skrives", async ({ page }) => {
    await begin(page, "dark", 2, ["Lars", "Vadla", "Moen"]);
    await keys(page, "50");
    await keys(page, "40");
    await keys(page, "60");
    await keys(page, "70");
    // Vadla lost a life with 40: she is on the last one when it comes back to her.
    await expect(card(page, "Vadla")).toContainText("SISTE LIV");
    await expect(page.getByText("VADLA MÅ HA MINST")).toBeVisible();
    await keys(page, "3");
    await expect(page.getByRole("status")).toContainText("3 er for lite");
    await page.getByRole("button", { name: "Slett" }).click();
    await keys(page, "30");
    await expect(card(page, "Vadla")).toContainText("Ute i runde 2 med 30");
    await expect(page.getByRole("img", { name: /^Rundene: 50, 40, 60, 70, 30/ })).toBeVisible();
  });
});
