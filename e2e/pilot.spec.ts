import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PIN, THEMES, openApp } from "./helpers";

/** Ly Pilotturnering from the setup to the course: four players, the rest bots, and the whole course there from the start. */
test.describe("Ly Pilotturnering", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  for (const theme of THEMES) {
    test(`oppsett og løype (${theme})`, async ({ page }) => {
      await openApp(page, theme);
      await page.getByRole("button", { name: "Turnering" }).first().click();
      for (const name of ["Lars", "Vadla", "Moen", "Hans"]) {
        await page.getByRole("button", { name: "Ny spiller" }).click();
        await page.getByPlaceholder("Spillernavn").fill(name);
        await page.getByRole("button", { name: "Legg til" }).click();
      }
      await page.getByRole("radio", { name: "Mot boter" }).click();
      await page.getByRole("radio", { name: /Ly Pilotturnering/ }).click();
      // One size only, so there is no number to choose.
      await expect(page.getByText("Antall")).toHaveCount(0);
      await page.getByRole("button", { name: "Neste" }).click();

      // The course is there from the start: heats with four in each, and the places that are not known yet say what fills them.
      await expect(page.getByRole("heading", { name: "HEAT", exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("NESTE · HEAT A")).toBeVisible();
      for (const stage of ["Vinnerbaner", "Taperbaner", "Lucky loser", "Kvartfinale", "Semifinale", "Finale"]) await expect(page.getByRole("heading", { name: stage.toUpperCase(), exact: true })).toBeVisible();
      await expect(page.getByText("1. i Heat A").first()).toBeVisible();
      await expect(page.getByRole("list", { name: "Rekkefølgen de kaster i" }).getByRole("listitem")).toHaveCount(4);

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }

  test("spilles av enkeltspillere", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Turnering" }).first().click();
    await page.getByRole("radio", { name: "Lag" }).click();
    await page.getByRole("radio", { name: "Mot boter" }).click();
    await page.getByRole("radio", { name: /Ly Pilotturnering/ }).click();
    await expect(page.getByText("Ly Pilotturnering spilles av enkeltspillere")).toBeVisible();
  });
});
