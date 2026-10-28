import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Karriere: a career is opened, the Lü-cupen is entered, drawn and started with the app's own tournament, and it is still there after a reload. */
const CAREER = {
  v: 1,
  id: "lars",
  player: "Lars",
  createdAt: "2026-10-28T10:00:00Z",
  savedAt: "2026-10-28T10:00:00Z",
  profile: { home: "garage", darts: "middels" },
  startLevel: "dyktig",
  skillMed: 37,
  money: 300,
  points: 0,
  titles: 0,
  played: 0,
  history: [],
  active: null,
};

async function toCareer(page: Page, seed = true) {
  await page.addInitScript(
    ([career, put]) => {
      localStorage.setItem("mikke-mus-bot-speed", "instant");
      // Only the first load puts the career there: after that it is what the app has saved.
      if (put === "1" && !sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("mikke-mus-career:lars", career);
      }
    },
    [JSON.stringify(CAREER), seed ? "1" : "0"],
  );
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Karriere" }).click();
}

test.describe("karriere", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("uten spillere i listen vises en veiledning", async ({ page }) => {
    await toCareer(page, false);
    await expect(page.getByText("Legg til en spiller under Spillere først.")).toBeVisible();
  });

  test("meld deg på, trekning, start cupen, og den ligger der etter en omlasting", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    // The home is the background; from it there is training, the arena, tournaments and challenges.
    await expect(page.getByRole("img", { name: "Garasjen din" })).toBeVisible();
    await expect(page.getByText("$300")).toBeVisible();
    await expect(page.getByRole("button", { name: /Trening/ })).toBeEnabled();
    await page.getByRole("button", { name: /Turneringer/ }).click();
    // Every step of the ladder is there; the pub is free and the rest are shut until the player has qualified, or has the money.
    await expect(page.getByRole("heading", { name: "Verdensmesterskapet" }).or(page.getByRole("heading", { name: "VM i dart" }))).toBeVisible();
    await expect(page.getByText("Kom blant de fire beste i Regionmesterskapet")).toBeVisible();
    await page.getByRole("button", { name: "Meld deg på" }).first().click();
    // The scene of the pub, then the draw.
    await expect(page.getByRole("img", { name: /Puben Lü/ })).toBeVisible();
    await page.getByRole("button", { name: "Til trekningen" }).click();
    // The draw of the tournaments, with the career's field in it.
    await expect(page.getByText("Lü-cupen · 8")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lars (1)" })).toBeVisible();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();

    // The career keeps the cup, and the fee is paid.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"));
    expect(saved.money).toBe(300);
    expect(saved.active.tournament.matches.length).toBeGreaterThanOrEqual(7);

    await page.reload();
    await page.getByRole("button", { name: "Karriere" }).click();
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByText("PÅGÅR")).toBeVisible();
    await page.getByRole("button", { name: "Fortsett" }).click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();
  });

  test("utfordring: velg spillet, se innsatsen, spill, og gi opp uten å tape noe", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /Utfordringer/ }).click();
    await expect(page.getByText("Vinn $150 · ingen inngang")).toBeVisible();
    await page.getByRole("button", { name: "Utfordre" }).first().click();
    await expect(page.getByText("UTFORDRER DEG")).toBeVisible();
    await expect(page.getByText("INNSATS")).toBeVisible();
    await page.getByRole("button", { name: "Spill", exact: true }).click();
    // The game of 501 is on; leaving it gives the challenge up.
    await expect(page.getByRole("button", { name: /Gi opp/ })).toBeVisible();
    await page.getByRole("button", { name: /Gi opp/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Gi opp" }).click();
    await expect(page.getByRole("button", { name: /Turneringer/ })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"));
    expect(saved.money).toBe(300);
    expect(saved.challenge).toBeNull();
  });

  test("hjemmearena: kjøp gulv, pengene går, og rommet er bygget om", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /Hjemmearena/ }).click();
    // The floor costs $300; the wall at $500 is too much for the $300 there is.
    await expect(page.getByText("Du mangler $200")).toBeVisible();
    await page.getByRole("button", { name: "Kjøp for $300" }).first().click();
    await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"))).arena.floor).toBe(1);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"));
    expect(saved.money).toBe(0);
    await expect(page.getByText("Motstanderne er 0,8 % svakere")).toBeVisible();
  });

  test("trening: femten runder flytter nivået, og det blir lagret", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /Trening/ }).click();
    await expect(page.getByText("MED 37,0 mm")).toBeVisible();
    await page.getByRole("button", { name: "Start økten" }).click();
    const keys = page.getByRole("group", { name: "Tastatur" });
    for (let i = 0; i < 15; i++) {
      await expect(page.getByText(`Runde ${i + 1} av 15`)).toBeVisible();
      await keys.getByRole("button", { name: "4", exact: true }).click();
      await keys.getByRole("button", { name: "5", exact: true }).click();
    }
    await expect(page.getByText("SNITT PER RUNDE")).toBeVisible();
    await expect(page.getByText("Du ble skarpere")).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"));
    expect(saved.skillMed).toBeLessThan(37);
    expect(saved.skillMed).toBeGreaterThanOrEqual(34);
    expect(saved.training).toHaveLength(1);
    await page.getByRole("button", { name: "Ferdig" }).click();
    await expect(page.getByRole("button", { name: /Turneringer/ })).toBeVisible();
  });
});
