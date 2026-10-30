import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/**
 * A picture of each screen of the career, with the same career every time, so a change that moves or breaks something is seen (a button that lost
 * its look, text that is cut). Run with `npm run test:visual:career`; after a change that is meant, make new pictures with
 * `npm run test:visual:career:update` and look at them.
 */
const CAREER = {
  v: 1, id: "lars", player: "Lars", createdAt: "2026-10-28T10:00:00Z", savedAt: "2026-10-28T10:00:00Z",
  profile: { home: "garage", darts: "steel", character: "c1" }, startLevel: "dyktig", skillMed: 37, money: 1300, points: 14, titles: 1, played: 6,
  history: [{ at: "2026-10-28T10:00:00Z", event: "Ly-cupen", place: "winner", prize: 500, cost: 0, points: 5 }], active: null,
  trophies: [{ tier: "lu", at: "2026-10-28T10:00:00Z", prize: 500 }], best: { lu: "winner" }, room: 2,
  ledger: [{ week: 1, kind: "prize", label: "Premie: Ly-cupen", amount: 500 }],
};

async function open(page: Page) {
  await page.addInitScript((c) => {
    localStorage.setItem("mikke-mus-bot-speed", "instant");
    localStorage.setItem("mikke-mus-career-story", "1");
    localStorage.setItem("mikke-mus-openings", JSON.stringify(["lu", "region", "nm", "gs", "vm"]));
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("mikke-mus-career:lars", c);
    }
  }, JSON.stringify(CAREER));
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Karriere" }).click();
  await page.getByRole("button", { name: /Lars/ }).click();
}

const snap = async (page: Page, name: string) => {
  await page.waitForTimeout(900);
  // Half a per cent: a word that is cut on a narrow phone is seen.
  await expect(page).toHaveScreenshot(`karriere-${name}.png`, { mask: [page.locator('[aria-label="Lagret"]')], maxDiffPixelRatio: 0.005 });
};

test.describe("karriere, skjermbilder", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("hjem, trening, turneringer, profil, meldinger og regnskap", async ({ page }) => {
    await open(page);
    await snap(page, "hjem");
    await page.getByRole("button", { name: /^Trening/ }).click();
    await snap(page, "trening");
    await page.getByRole("button", { name: "Tilbake" }).first().click();
    await page.getByRole("button", { name: /^Turneringer/ }).click();
    await snap(page, "turneringer");
    await page.getByRole("button", { name: "Tilbake" }).first().click();
    await page.getByRole("button", { name: /^Profil/ }).click();
    await snap(page, "profil");
    await page.getByRole("tab", { name: "Pokaler" }).click();
    await snap(page, "pokaler");
    await page.getByRole("button", { name: "Tilbake" }).first().click();
    await page.getByRole("button", { name: /^Meldinger/ }).click();
    await snap(page, "meldinger");
    await page.getByRole("button", { name: /^Regnskap, saldo/ }).click();
    await snap(page, "regnskap");
  });
});
