import { expect, test } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Spillere: a tap on the small picture of a row opens it large, with the way to change it; the rest of the row opens the player. */
test.describe("bildet i spillerlisten", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("et trykk på bildet åpner det stort med Velg bilde, og raden åpner fortsatt spilleren", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify([{ name: "Lars og Per", members: ["Lars", "Per"], lastUsed: 1000 }]));
    });
    await openApp(page, "dark");
    // A team the device remembers is put in Spillere once the team list has been seen.
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();
    await expect(page.getByRole("group", { name: "Lag" }).getByRole("button", { name: /Lars og Per/ })).toBeVisible();
    await page.getByRole("button", { name: "Tilbake" }).first().click();
    await page.getByRole("link", { name: "Spillere" }).first().click();
    await expect(page.getByRole("link", { name: /Lars og Per/ }).first()).toBeVisible();
    const url = page.url();
    await page.getByRole("button", { name: "Se bilde av Lars og Per" }).click();
    const sheet = page.getByRole("dialog", { name: "Lars og Per" });
    await expect(sheet).toBeVisible();
    // The page did not change: only the picture opened.
    expect(page.url()).toBe(url);
    await expect(sheet.getByRole("button", { name: "Velg bilde" })).toBeVisible();
    await sheet.getByRole("button", { name: "Lukk" }).last().click();
    await expect(sheet).toHaveCount(0);
    // The row itself still opens the player.
    await page.getByRole("link", { name: /Lars og Per/ }).first().click();
    await expect(page).toHaveURL(/\/spillere\/Lars/);
  });
});
