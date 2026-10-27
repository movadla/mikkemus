import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { THEMES, openApp } from "./helpers";

/** Innstillinger: how fast the bots throw. A setting of the device that is kept. */
test.describe("hastighet på boter", () => {
  for (const theme of THEMES) {
    test(`kan settes og huskes (${theme})`, async ({ page }) => {
      await openApp(page, theme, { welcomed: true });
      await page.goto("/innstillinger");
      const group = page.getByRole("radiogroup", { name: "Hastighet på boter" });
      await expect(group.getByRole("radio", { name: "Vanlig" })).toHaveAttribute("aria-checked", "true");
      await group.getByRole("radio", { name: "Rask" }).click();
      await expect(group.getByRole("radio", { name: "Rask" })).toHaveAttribute("aria-checked", "true");
      expect(await page.evaluate(() => localStorage.getItem("mikke-mus-bot-speed"))).toBe("fast");
      await page.reload();
      await expect(page.getByRole("radiogroup", { name: "Hastighet på boter" }).getByRole("radio", { name: "Rask" })).toHaveAttribute("aria-checked", "true");

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
});
