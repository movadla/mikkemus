import { expect, test, type Page } from "@playwright/test";
import { PIN } from "./helpers";

/** The limited code, from the environment like the full one: it is not written in the source. */
const LIMITED = process.env.E2E_PIN_LIMITED;

/** The door: log in with the full code, log out in Innstillinger, log in with the limited one and see what others see. */
async function type(page: Page, code: string) {
  await expect(page.getByText("Skriv inn koden")).toBeVisible({ timeout: 30_000 });
  for (const digit of code) await page.getByRole("button", { name: digit, exact: true }).first().click();
}

test.describe("logg ut", () => {
  test.skip(!PIN || !LIMITED, "E2E_PIN and E2E_PIN_LIMITED are not set");

  test("ut med hele koden, inn med den begrensede, og tilbake", async ({ page }) => {
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.addInitScript(() => localStorage.setItem("mikke-mus-welcomed", "1"));
    await page.goto("/innstillinger");
    await type(page, PIN!);
    await expect(page.getByText("Du er inne med hele koden")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Statistikk" })).toBeVisible();

    await page.getByRole("button", { name: "Logg ut" }).click();
    await type(page, LIMITED!);
    await expect(page.getByText("Du er inne med den begrensede koden")).toBeVisible({ timeout: 20_000 });
    // What the limited code does not see: the statistics tab is gone from the menu.
    await expect(page.getByRole("link", { name: "Statistikk" })).toHaveCount(0);

    await page.getByRole("button", { name: "Logg ut" }).click();
    await type(page, PIN!);
    await expect(page.getByText("Du er inne med hele koden")).toBeVisible({ timeout: 20_000 });
  });
});
