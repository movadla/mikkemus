import { expect, test } from "@playwright/test";
import { PIN, openApp, startPast } from "./helpers";

/** Bull-duell: «Først til» starts at 10 and goes to 99, or «Best av 3 piler». */
test.describe("bull-duell", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("først til starter på 10 og kan flyttes til 99, eller best av 3 piler", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Bull-duell" }).first().click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("button", { name: /Start|Neste/ }).first().click();

    // The choice, with «Først til» chosen and 10 points.
    await expect(page.getByRole("radio", { name: "Først til" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Først til 10 poeng")).toBeVisible();
    // 10 more nine times is far past the top: it stops at 99.
    for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "Flere poeng (+10)" }).click({ force: true }).catch(() => {});
    await expect(page.getByText("Først til 99 poeng")).toBeVisible();
    await page.getByRole("button", { name: "Færre poeng (−10)" }).click();
    await expect(page.getByText("Først til 89 poeng")).toBeVisible();

    // The other way to play it: no number to choose, and three darts each.
    await page.getByRole("radio", { name: "Best av 3 piler" }).click();
    await expect(page.getByText(/Alle kaster tre piler/)).toBeVisible();
    await expect(page.getByText("Best av 3 piler").last()).toBeVisible();
    await page.getByRole("button", { name: /Start Bull-duell/ }).click();
    await startPast(page);
    // In the game it says what it is, and no race to a number.
    await expect(page.getByRole("status").filter({ hasText: "Best av 3 piler" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/\/ \d+$/)).toHaveCount(0);
  });
});
