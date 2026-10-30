import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Best av x: den som vinner flest spill først vinner serien, og serien er én kamp i Kveldsscore. */
const keys = async (page: Page, d: string) => {
  for (const c of d) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: c, exact: true }).click();
};
/** 301: Lars 180, Vadla 60, Lars 121 (ut på to piler). */
async function lars_wins(page: Page) {
  await keys(page, "180");
  await keys(page, "60");
  await keys(page, "121");
  await page.getByRole("dialog", { name: "Hvor mange piler tok siste runde?" }).getByRole("button", { name: "2 piler" }).click();
}

test.describe("best av x", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("301 best av 3: to seiere vinner serien, og serien er én linje i Kveldsscore", async ({ page }) => {
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
    await page.getByRole("radiogroup", { name: "Best av" }).getByRole("radio", { name: "3" }).click();
    await expect(page.getByText("Den som vinner 2 spill først")).toBeVisible();
    await page.getByRole("button", { name: "Start kampen" }).click();
    await expect(page.getByText("Best av 3 · Lars 0–0 Vadla")).toBeVisible();
    await lars_wins(page);
    // One game each way is not enough: the series goes on.
    await expect(page.getByText("Serien: Lars 1–0 Vadla")).toBeVisible();
    await page.getByRole("button", { name: "Neste kamp" }).click();
    await expect(page.getByText("Best av 3 · Lars 1–0 Vadla")).toBeVisible();
    await lars_wins(page);
    await expect(page.getByText(/Lars vant serien \(best av 3\) · Lars 2–0 Vadla/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Ny serie" })).toBeVisible();
    await page.getByRole("button", { name: "Til forsiden" }).click();
    // The series is one match in Kveldsscore, told by its games.
    await expect(page.getByRole("link", { name: /Kveldsscore: 1 kamper i kveld/ })).toBeVisible();
    await page.getByRole("link", { name: /Kveldsscore/ }).click();
    await page.getByRole("radio", { name: /^Kamper/ }).click();
    const line = page.getByRole("list", { name: "Kamper" }).getByRole("button");
    await expect(line).toHaveCount(1);
    await expect(line.first()).toContainText("Lars vs. Vadla");
    await expect(line.first()).toContainText("2-0");
    await expect(line.first()).toContainText("Best av 3");
  });
});
