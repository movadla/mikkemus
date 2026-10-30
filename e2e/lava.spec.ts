import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PIN, THEMES, openApp } from "./helpers";

/** Lava: a section that is hit is lava for everyone from then on, and a dart in it costs a life. */
async function begin(page: Page, theme: "dark" | "light", lives?: number, rings = false) {
  await openApp(page, theme);
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: "Lava" }).click();
  for (const name of ["Lars", "Vadla"]) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  if (lives || rings) {
    await page.getByRole("switch", { name: /Avanserte innstillinger/ }).click();
    if (rings) await page.getByRole("switch", { name: /Doble og trippel/ }).click();
    for (let i = DEFAULT; lives && i > lives; i--) await page.getByRole("button", { name: "Ett liv mindre" }).click();
  }
  await page.getByRole("button", { name: "Start kampen" }).click();
}
const DEFAULT = 3;
const board = (page: Page) => page.getByRole("group", { name: /Brettet/ });
const status = (page: Page) => page.getByRole("status");
const card = (page: Page, name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });

test.describe("Lava", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("de andre spillene ligger under én flis på forsiden", async ({ page }) => {
    await openApp(page, "dark");
    await expect(page.getByRole("button", { name: "Lava" })).toHaveCount(0);
    const more = page.getByRole("button", { name: "Andre spill" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    for (const name of ["301 / 501", "Highstriker", "Lava"]) await expect(page.getByRole("button", { name })).toBeVisible();
    await more.click();
    await expect(page.getByRole("button", { name: "Lava" })).toHaveCount(0);
  });

  for (const theme of THEMES) {
    test(`et treff brenner feltet, og et nytt treff der er lava (${theme})`, async ({ page }) => {
      await begin(page, theme);
      await board(page).getByRole("button", { name: "20", exact: true }).click();
      await expect(status(page)).toContainText("Lars: 20 er brent");
      await expect(board(page).getByRole("button", { name: "20, lava" })).toBeVisible();
      await board(page).getByRole("button", { name: "Bull", exact: true }).click();
      await expect(status(page)).toContainText("Lars: Bull er brent");
      // Third dart in lava: a life goes, and the round is over.
      await board(page).getByRole("button", { name: "20, lava" }).click();
      await expect(status(page)).toContainText("Lars: 20 er lava, mister et liv");
      await expect(card(page, "Lars").getByRole("img", { name: "2 av 3 liv igjen" })).toBeVisible();
      await expect(card(page, "Vadla")).toHaveAttribute("aria-current", "true");
      await page.screenshot({ path: "test-results/lava-board.png" });

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }

  test("bom koster ingenting, Angre tar pila tilbake, og siste med liv vinner", async ({ page }) => {
    await begin(page, "dark", 1);
    await page.getByRole("button", { name: "Bom", exact: true }).click();
    await expect(status(page)).toContainText("Lars: bom");
    await page.getByRole("button", { name: "Angre", exact: true }).click();
    await board(page).getByRole("button", { name: "7", exact: true }).click();
    await board(page).getByRole("button", { name: "7, lava" }).click();
    // One life each: Lars is out at once, and Vadla is the last one standing.
    await expect(page.getByText("LAVA · SISTE I LIVE")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vadla" })).toBeVisible();
    await page.screenshot({ path: "test-results/lava-winner.png" });
    await page.getByRole("button", { name: "Angre siste pil" }).click();
    await expect(page.getByRole("list", { name: "Stilling" })).toBeVisible();
  });

  test("med doble og trippel er hver dobbel og trippel et felt for seg", async ({ page }) => {
    await begin(page, "dark", undefined, true);
    await board(page).getByRole("button", { name: "T20", exact: true }).click();
    await expect(status(page)).toContainText("Lars: T20 er brent");
    // The number itself and its double are other sections: still safe.
    await board(page).getByRole("button", { name: "20", exact: true }).click();
    await expect(status(page)).toContainText("Lars: 20 er brent");
    await board(page).getByRole("button", { name: "D20", exact: true }).click();
    await expect(status(page)).toContainText("Lars: D20 er brent");
    // A second dart in the treble is lava.
    await board(page).getByRole("button", { name: "T20, lava" }).click();
    await expect(status(page)).toContainText("T20 er lava");
    await page.screenshot({ path: "test-results/lava-rings.png" });
  });
});
