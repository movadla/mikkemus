import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Karriere: the home, the road of tournaments, the pub's cup from the draw to a reload, the challenges, the arena, the training and a new place. */
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

async function seed(page: Page, career: object | null) {
  await page.addInitScript(
    ([c]) => {
      localStorage.setItem("mikke-mus-bot-speed", "instant");
      // Only the first load puts the career there: after that it is what the app has saved.
      if (c && !sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("mikke-mus-career:lars", c);
      }
    },
    [career ? JSON.stringify(career) : ""],
  );
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Karriere" }).click();
}

async function toCareer(page: Page, withCareer = true) {
  await seed(page, withCareer ? CAREER : null);
}

const bar = (page: Page) => page.getByRole("navigation", { name: "Karriere" });
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"));

test.describe("karriere", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("uten spillere i listen vises en veiledning", async ({ page }) => {
    await toCareer(page, false);
    await expect(page.getByText("Legg til en spiller under Spillere først.")).toBeVisible();
  });

  test("hjemmet: rommet, status, ett stort turneringskort, neste mål og nedre meny", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByRole("img", { name: "Garasjen din" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Status" }).getByText("$300")).toBeVisible();
    // The tournament is the big thing: with $300 the regional championship is the biggest step that can be entered.
    const hero = page.getByRole("region", { name: "NESTE TURNERING" });
    await expect(hero.getByRole("heading", { name: "Regionmesterskapet" })).toBeVisible();
    await expect(hero.getByRole("button", { name: "Spill Regionmesterskapet · $200" })).toBeVisible();
    // The goals nearest at hand, with bars.
    await expect(page.getByRole("region", { name: "Neste mål" })).toBeVisible();
    await expect(page.getByRole("progressbar").first()).toBeVisible();
    // The bar: the five places, the tournaments in the middle.
    for (const name of ["Hjem", "Arena", "Turneringer", "Trening", "Utfordring"]) await expect(bar(page).getByRole("button", { name })).toBeVisible();
    await expect(bar(page).getByRole("button", { name: "Hjem" })).toHaveAttribute("aria-current", "page");
  });

  test("veien: alle turneringer vises, de låste sier hva som kreves, og Lü-cupen spilles til trekning og omlasting", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await bar(page).getByRole("button", { name: "Turneringer" }).click();
    const road = page.getByRole("list", { name: "Veien til VM" });
    for (const name of ["VM i dart", "Grand Slam", "Norgesmesterskapet", "Regionmesterskapet", "Lü-cupen"]) await expect(road.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
    await expect(road.getByText("Kom blant de fire beste i Regionmesterskapet").first()).toBeVisible();
    await expect(road.getByText("Bli nummer én eller to i Grand Slam").first()).toBeVisible();
    await road.getByRole("button", { name: /^Lü-cupen/ }).click();
    await page.getByRole("button", { name: "Spill Lü-cupen · gratis" }).click();
    // The scene of the pub, then the draw of the tournaments, with the career's field in it.
    await expect(page.getByRole("img", { name: /Puben Lü/ })).toBeVisible();
    await page.getByRole("button", { name: "Trekk lodd" }).click();
    // The pairs are cards that turn over, the player's own marked, and the draw is not set up in the career.
    await expect(page.getByText("Lü-pokalen").first()).toBeVisible();
    await expect(page.getByLabel("Trekningen").getByText("DU")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Seedet", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Endre", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Start turneringen" }).click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();
    // No trophy cabinet or delete button in the career: giving up is behind the three dots and says what it costs.
    await expect(page.getByRole("button", { name: "Pokaler" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Slett turnering" })).toHaveCount(0);
    // A card before every match, with the form of the opponent and what winning is worth.
    await page.getByRole("button", { name: "Start kampen" }).click();
    await expect(page.getByText("FORM I DAG")).toBeVisible();
    await expect(page.getByText(/Seier tar deg til semifinale/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kast ut mot / })).toBeVisible();
    await page.getByRole("button", { name: "Tilbake til oversikten" }).click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();

    // The career keeps the cup, and the pub is free.
    const s = await saved(page);
    expect(s.money).toBe(300);
    expect(s.active.tournament.matches.length).toBeGreaterThanOrEqual(7);

    await page.reload();
    await page.getByRole("button", { name: "Karriere" }).click();
    await page.getByRole("button", { name: /Lars/ }).click();
    // The cup that is going is the big card, and its button says who is next.
    const hero = page.getByRole("region", { name: "PÅGÅR" });
    await expect(hero.getByRole("heading", { name: "Lü-cupen" })).toBeVisible();
    await hero.getByRole("button", { name: /^Spill kvartfinalen mot / }).click();
    await expect(page.getByRole("button", { name: "Start kampen" })).toBeVisible();
  });

  test("utfordring: velg spillet, se innsatsen, spill, og gi opp uten å tape noe", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await bar(page).getByRole("button", { name: "Utfordring" }).click();
    await expect(page.getByText("Vinn $150 · ingen inngang")).toBeVisible();
    await page.getByRole("button", { name: "Spill 501 · vinn $150" }).click();
    await expect(page.getByText("UTFORDRER DEG")).toBeVisible();
    await expect(page.getByText("INNSATS")).toBeVisible();
    await page.getByRole("button", { name: /^Spill 501 mot / }).click();
    // The game of 501 is on; leaving it gives the challenge up.
    await expect(page.getByRole("button", { name: /Gi opp/ })).toBeVisible();
    await page.getByRole("button", { name: /Gi opp/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Gi opp" }).click();
    await expect(bar(page).getByRole("button", { name: "Turneringer" })).toBeVisible();
    const s = await saved(page);
    expect(s.money).toBe(300);
    expect(s.challenge).toBeNull();
  });

  test("hjemmearena: kjøp gulv, pengene går, og rommet er bygget om", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await bar(page).getByRole("button", { name: "Arena" }).click();
    // The floor costs $300; the wall at $500 is too much for the $300 there is.
    await expect(page.getByText("Du mangler $200")).toBeVisible();
    await page.getByRole("button", { name: "Kjøp for $300" }).first().click();
    await expect.poll(async () => (await saved(page)).arena.floor).toBe(1);
    expect((await saved(page)).money).toBe(0);
    await expect(page.getByText("Motstanderne er 0,8 % svakere")).toBeVisible();
  });

  test("trening: femten runder flytter nivået, og det blir lagret", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await bar(page).getByRole("button", { name: "Trening" }).click();
    await expect(page.getByText("MED 37,0 mm")).toBeVisible();
    await page.getByRole("button", { name: "Start treningen" }).click();
    const keys = page.getByRole("group", { name: "Tastatur" });
    for (let i = 0; i < 15; i++) {
      await expect(page.getByText(`Runde ${i + 1} av 15`)).toBeVisible();
      await keys.getByRole("button", { name: "4", exact: true }).click();
      await keys.getByRole("button", { name: "5", exact: true }).click();
    }
    await expect(page.getByText("SNITT PER RUNDE")).toBeVisible();
    await expect(page.getByText("Du ble skarpere")).toBeVisible();
    const s = await saved(page);
    expect(s.skillMed).toBeLessThan(37);
    expect(s.skillMed).toBeGreaterThanOrEqual(34);
    expect(s.training).toHaveLength(1);
    await page.getByRole("button", { name: "Tilbake til rommet" }).click();
    await expect(bar(page).getByRole("button", { name: "Turneringer" })).toBeVisible();
  });

  test("nytt sted: kjøp klubbrommet, og alt du har kjøpt flytter med", async ({ page }) => {
    const rich = { ...CAREER, money: 20000, profile: { home: "loft", darts: "middels" }, arena: { wall: 0, floor: 0, board: 1, light: 0, decor: 0, crowd: 0 } };
    await seed(page, rich);
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByRole("img", { name: "Loftet ditt" })).toBeVisible();
    await bar(page).getByRole("button", { name: "Arena" }).click();
    await page.getByRole("button", { name: "Kjøp for $15 000" }).click();
    await expect(page.getByRole("img", { name: "Klubbrommet ditt" })).toBeVisible();
    const s = await saved(page);
    expect(s.profile.home).toBe("club");
    expect(s.money).toBe(5000);
    expect(s.arena.board).toBe(1);
  });

  test("menyen: slett karrieren ligger bak de tre prikkene og sier hva det koster", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: "Meny" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Slett karrieren" }).click();
    await expect(page.getByText(/Saldo, pokaler og alt du har kjøpt er borte/)).toBeVisible();
    await page.getByRole("button", { name: "Behold" }).click();
    expect(await saved(page)).not.toBeNull();
  });

  test("tilgjengelighet: hjem, veien, arena, trening og utfordringer har ingen brudd", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    const check = async () => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 4).map((x) => x.target.join(" ")).join(" | ")}`)).toEqual([]);
    };
    await page.waitForTimeout(1500);
    await check();
    for (const tab of ["Turneringer", "Arena", "Trening", "Utfordring"]) {
      await bar(page).getByRole("button", { name: tab }).click();
      await page.waitForTimeout(700);
      await check();
    }
  });
});
