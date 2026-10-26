import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PIN, SCREENS, THEMES, openApp } from "./helpers";

/**
 * What a person who sees badly, or reads big text, or has no network, meets: contrast and the other automatic checks of the
 * accessibility rules (axe) on every screen in both themes, text at 200 % without anything running off the side, and the
 * screens with the database empty and with it out of reach. Run with the code of the app in E2E_PIN: `E2E_PIN=... npm run test:a11y`.
 */
test.describe("tilgjengelighet", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  for (const theme of THEMES) {
    for (const s of SCREENS) {
      test(`kontrast og regler: ${s.name} (${theme})`, async ({ page }) => {
        await openApp(page, theme);
        if (s.path !== "/") await page.goto(s.path);
        await page.waitForTimeout(800);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        // A violation names the rule and the elements: the message is what to fix.
        const describeNode = (n: (typeof results.violations)[number]["nodes"][number]) => {
          const c = n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
          return `${n.target.join(" ")}${c?.contrastRatio ? ` [${c.fgColor} på ${c.bgColor}, ${c.contrastRatio.toFixed(2)}]` : ""}`;
        };
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 4).map(describeNode).join(" | ")}${v.nodes.length > 4 ? ` … (${v.nodes.length})` : ""}`)).toEqual([]);
      });
    }
  }

  for (const s of SCREENS.filter((x) => x.name !== "storskjerm")) {
    test(`200 % tekst: ${s.name} har ingenting utenfor siden`, async ({ page }) => {
      await openApp(page, "dark");
      if (s.path !== "/") await page.goto(s.path);
      // Larger text, as the phone's setting makes it: the root size doubled.
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  for (const database of ["empty", "offline"] as const) {
    for (const s of SCREENS) {
      test(`${s.name} med ${database === "empty" ? "tom database" : "databasen utenfor rekkevidde"}`, async ({ page }) => {
        await openApp(page, "dark", { database });
        if (s.path !== "/") await page.goto(s.path);
        await page.waitForTimeout(800);
        // The page is there, not the framework's error screen, and it says something.
        await expect(page.getByText("Application error")).toHaveCount(0);
        await expect(page.getByText("Something went wrong")).toHaveCount(0);
        expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(5);
      });
    }
  }
});
