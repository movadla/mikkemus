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
const place = (page: Page, name: "Rom" | "Trening" | "Duell" | "Turneringer") => page.getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("karriere", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("uten spillere i listen vises en veiledning", async ({ page }) => {
    await toCareer(page, false);
    await expect(page.getByText("Legg til en spiller under Spillere først.")).toBeVisible();
  });

  test("hjemmet: rommet, saldo og nivå, ett mål, én stor knapp og fire runde", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    // The room is the picture behind everything: the first step of the room.
    await expect(page.locator(".room-backdrop-img")).toHaveAttribute("src", /room-02.jpg/);
    // The character stands in the room (the career in the seed has none saved: it gets the one there is), and the profile has its face.
    await expect(page.locator(".char-home .char-figure-img")).toHaveAttribute("src", /c03.noytral/);
    // It says where the player is: the room is a place with a name and a step.
    await expect(page.getByText(/Garasjen din/)).toContainText("Ryddet · 2 av 10");
    const hud = page.getByRole("group", { name: "Status" });
    await expect(hud.getByText("$300")).toBeVisible();
    // One star, not two: the goal says which rank it counts towards, and the rank is written under the name.
    await expect(hud.getByLabel(/^Nivå/)).toHaveCount(0);
    await expect(page.getByRole("progressbar", { name: "Neste rang: Regionspiller, 0 av 10 poeng" })).toBeVisible();
    await expect(page.getByText("Pubspiller", { exact: true })).toBeVisible();
    // The one big button leads to the biggest step that can be entered, with the price as a small line.
    await expect(play(page, "SPILL Region · $200")).toBeVisible();
    // Four round buttons. The room has no dot: the first step costs $500 and there is $300.
    for (const name of ["Rom", "Trening", "Duell", "Turneringer"] as const) await expect(place(page, name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Rom, nytt" })).toHaveCount(0);
    // Nothing else: no lists, no explanations, no second row of tabs.
    await expect(page.getByRole("navigation", { name: "Karriere" })).toHaveCount(0);
    await expect(page.getByText(/Velkommen til rommet/)).toHaveCount(0);
  });

  test("turneringer: alle med krav, pris og premie, de låste sier hva som kreves, og Ly-cupen spilles til trekning og omlasting", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Turneringer").click();
    const list = page.getByRole("list", { name: "Turneringer" });
    for (const name of ["Ly-cupen", "Regionmesterskapet", "Norgesmesterskapet", "Grand Slam", "VM i dart"]) await expect(list.getByRole("button", { name: new RegExp("^" + name) })).toBeVisible();
    // What it takes, what it costs, who plays, and the first prize.
    await expect(list.getByRole("button", { name: /^Ly-cupen/ })).toContainText("Åpen for alle");
    await expect(list.getByRole("button", { name: /^Ly-cupen/ })).toContainText("åpen");
    await expect(list.getByRole("button", { name: /^Norgesmesterskapet/ })).toContainText("Topp 4 i Region");
    await expect(list.getByRole("button", { name: /^Norgesmesterskapet/ })).toContainText("låst");
    await expect(list.getByRole("button", { name: /^VM i dart/ })).toContainText("Topp 2 i Grand Slam");
    await expect(list.getByRole("button", { name: /^VM i dart/ })).toContainText("$150");
    // A locked one says what it takes in the button, and the button is shut.
    await list.getByRole("button", { name: /^Norgesmesterskapet/ }).click();
    await expect(play(page, /^SPILL Krever topp 4 i Regionmesterskapet/)).toBeDisabled();
    await list.getByRole("button", { name: /^Ly-cupen/ }).click();
    await play(page, "SPILL Ly-cupen · gratis").click();
    // The scene of the pub, then the draw of the tournaments, with the career's field in it.
    await expect(page.getByRole("img", { name: /Puben Ly/ })).toBeVisible();
    await play(page, "TREKK").click();
    // The pairs are cards that turn over, the player's own marked, and the draw is not set up in the career.
    await expect(page.getByText("Ly-pokalen").first()).toBeVisible();
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
    await place(page, "Duell").click();
    await page.getByRole("list", { name: "Duell" }).getByRole("button", { name: /^501/ }).click();
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

  test("rom: ti trinn, ett bilde og én knapp, og pengene går", async ({ page }) => {
    await seed(page, { ...CAREER, money: 1100 });
    await page.getByRole("button", { name: /Lars/ }).click();
    // There is money for the first step: the room button has a dot.
    await expect(page.getByRole("button", { name: "Rom, nytt" })).toBeVisible();
    await place(page, "Rom").click();
    await expect(page.getByRole("img", { name: "Rommet ditt, trinn 2: Ryddet" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Trinn 2 av 10" })).toBeVisible();
    // What the next step adds, and the price as the button.
    await expect(page.getByRole("list", { name: "Du får" }).getByText("Maling")).toBeVisible();
    await play(page, "KJØP $1 000").click();
    await expect.poll(async () => (await saved(page)).room).toBe(2);
    expect((await saved(page)).money).toBe(100);
    await expect(page.getByRole("img", { name: "Rommet ditt, trinn 3: Nye vegger" })).toBeVisible();
    // The step is announced, and the room can be compared as it was and as it is.
    await expect(page.getByText("NYTT I ROMMET")).toBeVisible();
    await page.getByRole("button", { name: "Før og etter" }).click();
    await expect(page.getByRole("slider", { name: /sammenligne/ })).toBeVisible();
    await page.getByRole("button", { name: "Lukk sammenligningen" }).click();
    // Back at home the new thing is named for a while.
    await page.getByRole("button", { name: "Tilbake" }).click();
    await expect(page.getByRole("button", { name: /Nytt i rommet: Maling og veggpaneler/ })).toBeVisible();
    await place(page, "Rom").click();
    // The next step costs $2 000: too much, so the button is shut and says what is missing.
    await expect(play(page, /^KJØP .*2.000 · Mangler/)).toBeDisabled();
  });

  test("rommet er ferdig på det siste trinnet", async ({ page }) => {
    await seed(page, { ...CAREER, room: 9, money: 100000 });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Rom").click();
    await expect(page.getByRole("img", { name: "Rommet ditt, trinn 10: Drømmerommet" })).toBeVisible();
    await expect(play(page, /^FERDIG/)).toBeDisabled();
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
    await expect(page.getByText("SNITT PER RUNDE")).toBeVisible();
    const s = await saved(page);
    expect(s.skillMed).toBeLessThan(37);
    expect(s.skillMed).toBeGreaterThanOrEqual(34);
    expect(s.training).toHaveLength(1);
    await play(page, "OK").click();
    await expect(play(page, /^SPILL/)).toBeVisible();
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
    for (const tab of ["Turneringer", "Rom", "Trening", "Duell"] as const) {
      await place(page, tab).click();
      await page.waitForTimeout(700);
      await check();
      await page.getByRole("button", { name: "Tilbake" }).click();
    }
  });
});
