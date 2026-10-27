import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PIN, THEMES, openApp } from "./helpers";

/** 301 and 501: only what each round made is written in, and a round that can only be what it says goes in by itself. */
async function begin(page: Page, theme: "dark" | "light") {
  await openApp(page, theme);
  await page.getByRole("button", { name: "301 / 501" }).click();
  for (const name of ["Lars", "Vadla"]) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  await page.getByRole("radio", { name: "301" }).click();
  await page.getByRole("button", { name: "Start kampen" }).click();
}
const keys = async (page: Page, digits: string) => {
  for (const d of digits) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
};
const left = (page: Page, name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });

test.describe("301 og 501", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  for (const theme of THEMES) {
    test(`spilles med summene, uten Bekreft fra 19 og opp (${theme})`, async ({ page }) => {
      await begin(page, theme);
      await expect(left(page, "Lars")).toContainText("301");
      // 180 and 60 go in by themselves.
      await keys(page, "180");
      await expect(left(page, "Lars")).toContainText("121");
      await keys(page, "60");
      await expect(left(page, "Vadla")).toContainText("241");
      // A one-digit round has to be confirmed: it could still be 10 to 18 or 100 to 180.
      await keys(page, "5");
      await expect(left(page, "Lars")).toContainText("121");
      await page.getByRole("button", { name: "Bekreft" }).click();
      await expect(left(page, "Lars")).toContainText("116");

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }

  test("en runde over streken teller ikke, og siste runde spør hvor mange piler", async ({ page }) => {
    await begin(page, "dark");
    await keys(page, "180");
    await keys(page, "60");
    // Lars has 121 left: 150 is over the line.
    await keys(page, "150");
    await expect(left(page, "Lars")).toContainText("121");
    await expect(page.getByRole("status")).toContainText("over streken");
    await keys(page, "60");
    // Lars: 121 left, finishes with 121 in two darts.
    await keys(page, "121");
    await page.getByRole("dialog", { name: "Hvor mange piler tok siste runde?" }).getByRole("button", { name: "2 piler" }).click();
    await expect(page.getByRole("heading", { name: "Lars" })).toBeVisible();
    await expect(page.getByText(/på 8 piler/)).toBeVisible();
    await page.screenshot({ path: "test-results/countdown-winner.png" });
  });

  test("Angre tar siste runde tilbake", async ({ page }) => {
    await begin(page, "dark");
    await keys(page, "100");
    await expect(left(page, "Lars")).toContainText("201");
    await page.getByRole("button", { name: "Angre" }).click();
    await expect(left(page, "Lars")).toContainText("301");
  });
});
