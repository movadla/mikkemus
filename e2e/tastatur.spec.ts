import { expect, test } from "@playwright/test";
import { PIN, openApp, startPast } from "./helpers";

/** On a computer the board is played from the keyboard: Space marks the row the thrower is on, Enter is Bekreft, Backspace is Angre. */
test.describe("tastatur på brettet", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("mellomrom setter kryss, Enter bekrefter og Backspace angrer", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("button", { name: /Start/ }).first().click();
    await startPast(page);
    const thrower = page.getByRole("status").filter({ hasText: "Kaster" });
    await expect(thrower.getByText("Lars")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bekreft (bom)" })).toBeVisible();

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Bekreft", exact: true })).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(page.getByRole("button", { name: "Bekreft (bom)" })).toBeVisible();

    // D and T mark the rows D and T further down.
    await page.keyboard.press("t");
    await expect(page.getByRole("button", { name: "Bekreft", exact: true })).toBeVisible();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("d");
    await expect(page.getByRole("button", { name: "Bekreft", exact: true })).toBeVisible();
    await page.keyboard.press("Backspace");

    // Three Spaces in a row are three crosses on the number, the third one too.
    for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
    await expect(page.getByText("3 piler på rad")).toBeVisible();
    for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");

    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    await expect(thrower.getByText("Vadla")).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(thrower.getByText("Lars")).toBeVisible();
  });
});

/** The place lies behind the board in a tournament match too, with four in a heat as with two. */
test.describe("stedet bak brettet i turnering", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("en heat med fire har stedets bilde bak brettet", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Turnering" }).first().click();
    for (const name of ["Lars", "Vadla", "Moen", "Hans"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("radio", { name: "Mot boter" }).click();
    await page.getByRole("radio", { name: /Ly Pilotturnering/ }).click();
    await page.getByRole("button", { name: "Neste" }).click();
    await expect(page.getByText(/NESTE · HEAT [A-D]/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^(Spill|Start)/ }).last().click();
    await startPast(page);
    await expect(page.locator(".game-root.venue-bg")).toBeVisible();
  });
});
