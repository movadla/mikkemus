import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp, startPast } from "./helpers";

/** Angre after Bekreft: the turn that was confirmed opens again as it was, and the triple/double question can be answered again. */
async function start(page: Page) {
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Ny kamp" }).click();
  for (const name of ["Lars", "Vadla"]) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  await page.getByRole("switch", { name: /Avanserte innstillinger/ }).click();
  await page.getByRole("switch", { name: /Legg inn hver pil for hånd/ }).click();
  await page.getByRole("button", { name: /Start/ }).first().click();
  await startPast(page);
}

test.describe("angre etter bekreft", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("runden åpnes igjen med valget om trippel eller tre enkle", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Legg inn pil 1" }).click();
    await page.getByRole("dialog", { name: "Legg inn pil 1" }).getByRole("button", { name: "Trippel" }).click();
    await page.getByRole("dialog", { name: "Legg inn pil 2" }).getByRole("button", { name: "Bom", exact: true }).click();
    await page.getByRole("dialog", { name: "Legg inn pil 3" }).getByRole("button", { name: "Bom", exact: true }).click();
    const question = page.getByRole("group", { name: /velg hvor den skal telle/ });
    await expect(question).toBeVisible();
    // Answered: the three singles on the number.
    await question.getByRole("button", { name: /Sett på 20/ }).click();
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText("Vadla")).toBeVisible();

    // Angre: Lars is up again, with the question open to be answered again — the other way this time.
    await page.getByRole("button", { name: "Angre" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText("Lars")).toBeVisible();
    const again = page.getByRole("group", { name: /velg hvor den skal telle/ });
    await expect(again).toBeVisible();
    await again.getByRole("button", { name: /Sett på T/ }).click();
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText("Vadla")).toBeVisible();
  });

  test("uten valg tar Angre den siste pilen og runden har fortsatt tre", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Legg inn pil 1" }).click();
    await page.getByRole("dialog", { name: "Legg inn pil 1" }).getByRole("button", { name: "Enkel", exact: true }).click();
    await page.getByRole("dialog", { name: "Legg inn pil 2" }).getByRole("button", { name: "Bom", exact: true }).click();
    await page.getByRole("dialog", { name: "Legg inn pil 3" }).getByRole("button", { name: "Bom", exact: true }).click();
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText("Vadla")).toBeVisible();

    await page.getByRole("button", { name: "Angre" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText("Lars")).toBeVisible();
    // The last dart is the one that went: two are still there, and a third can be keyed in again.
    await expect(page.getByRole("button", { name: /^Pil 2: BOM/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pil 3:/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Legg inn pil 3" }).click();
    await page.getByRole("dialog", { name: "Legg inn pil 3" }).getByRole("button", { name: "Enkel", exact: true }).click();
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText("Vadla")).toBeVisible();
  });
});
