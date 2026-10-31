import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** The show around the career: only for the code 9999 (lib/pin.ts). Walks the screens and keeps a picture of each in test-results/show. */
const SHOTS = "test-results/show";

const CAREER = {
  v: 1,
  id: "lars",
  player: "Lars",
  createdAt: "2026-10-28T10:00:00Z",
  savedAt: "2026-10-28T10:00:00Z",
  profile: { home: "garage", darts: "steel", character: "c12" },
  startLevel: "dyktig",
  skillMed: 37,
  money: 4300,
  points: 60,
  titles: 2,
  worldTitles: 0,
  played: 5,
  history: [
    { at: "2026-10-28T10:00:00Z", event: "Ly-cupen", place: "winner", prize: 500, cost: 0, points: 10 },
    { at: "2026-10-28T11:00:00Z", event: "Trondheim Open", place: "final", prize: 600, cost: 100, points: 6 },
    { at: "2026-10-28T12:00:00Z", event: "Regionmesterskapet", place: "winner", prize: 2500, cost: 200, points: 25 },
  ],
  trophies: [
    { tier: "lu", at: "2026-10-28T10:00:00Z", prize: 500 },
    { tier: "region", at: "2026-10-28T12:00:00Z", prize: 2500 },
  ],
  active: null,
};

async function seed(page: Page, career: object) {
  await page.addInitScript(
    (c) => {
      localStorage.setItem("mikke-mus-bot-speed", "instant");
      localStorage.setItem("mikke-mus-career-story", "1");
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("mikke-mus-career:lars", c);
      }
    },
    JSON.stringify(career),
  );
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Karriere" }).click();
  await page.getByRole("button", { name: /Lars/ }).click();
}

test.describe("Show", () => {
  test.skip(PIN !== "9999", "E2E_PIN is not the show code");

  test("uken har et kort, og hjemmet har en hylle", async ({ page }) => {
    await seed(page, { ...CAREER, life: { week: 3, seasonPts: 41, reputation: 5, news: [], inbox: [], newsSeen: 0, sponsor: null, world: { drift: {}, retired: [], rookies: [], pts: {}, snap: {} }, seasons: [], counter: 0, weeks: { "1": { name: "Ly-cupen", place: "winner" }, "2": { name: "Trondheim Open", place: "final" } } } });
    await page.screenshot({ path: `${SHOTS}/week-card.png` });
    await expect(page.getByText(/UKE 3 AV 8/i)).toBeVisible();
    await page.getByText(/UKE 3 AV 8/i).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/home.png` });
  });

  test("sesongen er over: filmen spilles", async ({ page }) => {
    const life = { week: 9, seasonPts: 0, reputation: 5, news: [], inbox: [], newsSeen: 0, sponsor: null, world: { drift: {}, retired: [], rookies: [], pts: {}, snap: {} }, seasons: [{ season: 1, rank: 2, points: 41, prize: 300, winner: "Max Hartmann", table: [{ name: "Max Hartmann", pts: 60 }, { name: "Lars", pts: 41 }, { name: "Dave", pts: 30 }] }], counter: 0, recapSeen: 0, weeks: { "1": { name: "Ly-cupen", place: "winner" }, "2": { name: "Trondheim Open", place: "final" }, "3": { name: "Regionmesterskapet", place: "winner" }, "4": { name: "TBA", skipped: true }, "5": { name: "Norgesmesterskapet", place: "semi" } } };
    await seed(page, { ...CAREER, life });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/recap.png` });
    const film = page.getByRole("button", { name: /Se sesongen/ });
    if (await film.isVisible()) {
      await film.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/film-1.png` });
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${SHOTS}/film-2.png` });
    }
  });

  test("etter turneringen: avisen kan leses", async ({ page }) => {
    const active = { id: "lars-1", tier: "region", seed: 1, cost: 200, entrants: [], cup: { kind: "region", name: "Regionmesterskapet", trophy: "Regionpokalen", level: "4", growth: true, seed: 1, career: true }, tournament: null, result: { place: "winner", prize: 2500, cost: 200, points: 25 } };
    await seed(page, { ...CAREER, active, life: { week: 3, seasonPts: 41, reputation: 5, news: [], inbox: [], newsSeen: 0, sponsor: null, world: { drift: {}, retired: [], rookies: [], pts: {}, snap: {} }, seasons: [], counter: 0 } });
    await page.getByRole("button", { name: /^HENT/ }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/result.png` });
    const paper = page.getByRole("button", { name: /Les avisen/ });
    if (await paper.isVisible()) {
      await paper.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOTS}/paper.png` });
    }
  });
});
