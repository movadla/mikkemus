import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Karriere: the home (the room, one big button, four round ones), the road, the pub's cup from the draw to a reload, challenges, the room, training and a new place. */
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

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"));
const play = (page: Page, name: RegExp | string) => page.getByRole("button", { name });
const place = (page: Page, name: "Rom" | "Trening" | "Utfordring" | "Veien") => page.getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("karriere", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("uten spillere i listen vises en veiledning", async ({ page }) => {
    await toCareer(page, false);
    await expect(page.getByText("Legg til en spiller under Spillere først.")).toBeVisible();
  });

  test("hjemmet: rommet, saldo og nivå, ett mål, én stor knapp og fire runde", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByRole("img", { name: "Garasjen din" })).toBeVisible();
    const hud = page.getByRole("group", { name: "Status" });
    await expect(hud.getByText("$300")).toBeVisible();
    await expect(hud.getByLabel("Nivå 1, Pubspiller")).toBeVisible();
    // One goal: the way to the next level.
    await expect(page.getByRole("progressbar", { name: "Veien til nivå 2" })).toBeVisible();
    // The one big button leads to the biggest step that can be entered, with the price as a small line.
    await expect(play(page, "SPILL Region · $200")).toBeVisible();
    // Four round buttons, and the room has a dot: there is money for something new.
    for (const name of ["Rom", "Trening", "Utfordring", "Veien"] as const) await expect(place(page, name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Rom, nytt" })).toBeVisible();
    // Nothing else: no lists, no explanations, no second row of tabs.
    await expect(page.getByRole("navigation", { name: "Karriere" })).toHaveCount(0);
    await expect(page.getByText(/Velkommen til rommet/)).toHaveCount(0);
  });

  test("veien: alle turneringer med premie, de låste sier hva som kreves, og Lü-cupen spilles til trekning og omlasting", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Veien").click();
    const road = page.getByRole("list", { name: "Veien til VM" });
    for (const name of ["VM", "Slam", "NM", "Region", "Lü"]) await expect(road.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
    await expect(road.getByRole("button", { name: /^VM/ })).toContainText("$150");
    // A locked step says what it takes in the button, and the button is shut.
    await road.getByRole("button", { name: /^NM/ }).click();
    await expect(play(page, /^SPILL Kom blant de fire beste i Regionmesterskapet/)).toBeDisabled();
    await road.getByRole("button", { name: /^Lü/ }).click();
    await play(page, "SPILL gratis").click();
    // The scene of the pub, then the draw of the tournaments, with the career's field in it.
    await expect(page.getByRole("img", { name: /Puben Lü/ })).toBeVisible();
    await play(page, "TREKK").click();
    // The pairs are cards that turn over, the player's own marked, and the draw is not set up in the career.
    await expect(page.getByText("Lü-pokalen").first()).toBeVisible();
    await expect(page.getByLabel("Trekningen").getByText("DU")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Seedet", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Endre", { exact: true })).toHaveCount(0);
    await play(page, "START").click();
    await expect(play(page, "Start kampen")).toBeVisible();
    // No trophy cabinet or delete button in the career: giving up is behind the three dots and says what it costs.
    await expect(page.getByRole("button", { name: "Pokaler" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Slett turnering" })).toHaveCount(0);
    // A card before every match: the two of them, what winning secures, and one button.
    await play(page, "Start kampen").click();
    await expect(play(page, "KAST")).toBeVisible();
    await expect(page.getByText("$200", { exact: true })).toBeVisible();
    await expect(page.getByText("Form i dag", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Tilbake" }).click();
    await expect(play(page, "Start kampen")).toBeVisible();

    // The career keeps the cup, and the pub is free.
    const s = await saved(page);
    expect(s.money).toBe(300);
    expect(s.active.tournament.matches.length).toBeGreaterThanOrEqual(7);

    await page.reload();
    await page.getByRole("button", { name: "Karriere" }).click();
    await page.getByRole("button", { name: /Lars/ }).click();
    // The cup that is going is what the big button leads to, and it says who is next.
    await play(page, /^SPILL Kvartfinale · /).click();
    await expect(play(page, "Start kampen")).toBeVisible();
  });

  test("utfordring: velg spillet, se innsatsen, spill, og gi opp uten å tape noe", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Utfordring").click();
    await page.getByRole("list", { name: "Utfordringer" }).getByRole("button", { name: /^501/ }).click();
    // The two of them and the stake, and one button.
    await expect(page.getByText("$150", { exact: true })).toBeVisible();
    await play(page, "SPILL").click();
    // The game of 501 is on; leaving it gives the challenge up.
    await expect(page.getByRole("button", { name: /Gi opp/ })).toBeVisible();
    await page.getByRole("button", { name: /Gi opp/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Gi opp" }).click();
    await expect(play(page, /^SPILL/)).toBeVisible();
    const s = await saved(page);
    expect(s.money).toBe(300);
    expect(s.challenge).toBeNull();
  });

  test("rom: kjøp gulv, pengene går, og rommet er bygget om", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Rom").click();
    const tiles = page.getByRole("list", { name: "Rom" });
    // The wall costs $500: too much for the $300, so its button is grey with a lock.
    await expect(tiles.getByRole("button", { name: /\$500/ })).toBeDisabled();
    // The floor costs $300, and the price is the button.
    await tiles.getByRole("listitem").filter({ hasText: "Gulv" }).getByRole("button").click();
    await expect.poll(async () => (await saved(page)).arena.floor).toBe(1);
    expect((await saved(page)).money).toBe(0);
    // No sentences about what it does.
    await expect(page.getByText(/svakere/)).toHaveCount(0);
  });

  test("trening: femten runder flytter nivået, og det blir lagret", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Trening").click();
    await expect(page.getByText("Dyktig")).toBeVisible();
    await play(page, /^START/).click();
    const keys = page.getByRole("group", { name: "Tastatur" });
    for (let i = 0; i < 15; i++) {
      await expect(page.getByText(`${i + 1}/15`)).toBeVisible();
      await keys.getByRole("button", { name: "4", exact: true }).click();
      await keys.getByRole("button", { name: "5", exact: true }).click();
    }
    await expect(page.getByText("SNITT", { exact: true })).toBeVisible();
    const s = await saved(page);
    expect(s.skillMed).toBeLessThan(37);
    expect(s.skillMed).toBeGreaterThanOrEqual(34);
    expect(s.training).toHaveLength(1);
    await play(page, "OK").click();
    await expect(play(page, /^SPILL/)).toBeVisible();
  });

  test("nytt sted: kjøp klubbrommet, og alt du har kjøpt flytter med", async ({ page }) => {
    const rich = { ...CAREER, money: 20000, profile: { home: "loft", darts: "middels" }, arena: { wall: 0, floor: 0, board: 1, light: 0, decor: 0, crowd: 0 } };
    await seed(page, rich);
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByRole("img", { name: "Loftet ditt" })).toBeVisible();
    await place(page, "Rom").click();
    await page.getByRole("button", { name: /^\$15.000$/ }).click();
    await expect(page.getByRole("img", { name: "Klubbrommet ditt" })).toBeVisible();
    const s = await saved(page);
    expect(s.profile.home).toBe("club");
    expect(s.money).toBe(5000);
    expect(s.arena.board).toBe(1);
  });

  test("menyen: profil og slett karrieren ligger bak de tre prikkene, og slett sier hva det koster", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: "Meny" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Slett karrieren" }).click();
    await expect(page.getByText(/Saldo, pokaler og alt du har kjøpt er borte/)).toBeVisible();
    await page.getByRole("button", { name: "Behold" }).click();
    expect(await saved(page)).not.toBeNull();
  });

  test("første gang: en pil på den store knappen, og den er borte når den er trykket", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByRole("note").getByText("Trykk her")).toBeVisible();
    await play(page, /^SPILL/).click();
    await page.reload();
    await page.getByRole("button", { name: "Karriere" }).click();
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByText("Trykk her")).toHaveCount(0);
  });

  test("tilgjengelighet: hjem, veien, rom, trening og utfordringer har ingen brudd", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    const check = async () => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 4).map((x) => x.target.join(" ")).join(" | ")}`)).toEqual([]);
    };
    await page.waitForTimeout(1500);
    await check();
    for (const tab of ["Veien", "Rom", "Trening", "Utfordring"] as const) {
      await place(page, tab).click();
      await page.waitForTimeout(700);
      await check();
      await page.getByRole("button", { name: "Tilbake" }).click();
    }
  });
});
