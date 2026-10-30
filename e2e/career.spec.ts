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
  profile: { home: "garage", darts: "steel" },
  startLevel: "dyktig",
  skillMed: 37,
  money: 300,
  points: 0,
  titles: 0,
  played: 0,
  history: [],
  active: null,
};

async function seed(page: Page, career: object | null, story = false) {
  await page.addInitScript(
    ([c, story]) => {
      localStorage.setItem("mikke-mus-bot-speed", "instant");
      // The story a first career opens with has been seen, unless a test is about it.
      if (!story) localStorage.setItem("mikke-mus-career-story", "1");
      // Only the first load puts the career there: after that it is what the app has saved.
      if (c && !sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("mikke-mus-career:lars", c);
      }
    },
    [career ? JSON.stringify(career) : "", story] as const,
  );
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Karriere" }).click();
}

async function toCareer(page: Page, withCareer = true) {
  await seed(page, withCareer ? CAREER : null);
}

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-career:lars") ?? "null"));
const play = (page: Page, name: RegExp | string) => page.getByRole("button", { name });
const place = (page: Page, name: "Trening" | "Profil" | "Turneringer" | "Meldinger") => page.getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("karriere", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("første karriere: en historie med tre bilder som kan hoppes over, og som bare vises én gang", async ({ page }) => {
    await seed(page, null, true);
    await expect(page.getByText("Det begynte ved et kjøkkenbord")).toBeVisible();
    await page.getByRole("button", { name: "Neste", exact: true }).click();
    await expect(page.getByText("En kveld tok du bagen")).toBeVisible();
    await page.getByRole("button", { name: "Hopp over" }).click();
    await expect(page.getByRole("button", { name: "Ny spiller" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Karriere" }).click();
    await expect(page.getByRole("button", { name: "Ny spiller" })).toBeVisible();
  });

  test("ny karriere: legg til en spiller der, velg nivå og karakter, og start med 2 000 dollar", async ({ page }) => {
    await toCareer(page, false);
    // No players yet: the list has only the tile for a new one, and the career cannot go on.
    await expect(page.getByRole("radio", { name: "Ny spiller" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Neste", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill("Lars");
    await page.getByRole("button", { name: "Legg til" }).click();
    await expect(page.getByRole("radio", { name: /Lars/ })).toBeChecked();
    // The levels are rows with a meter, and the line under says what the chosen one means.
    await expect(page.getByRole("radio", { name: "Dyktig" })).toBeChecked();
    await page.getByRole("radio", { name: "Sterk" }).click();
    await expect(page.getByText("Treffer det du sikter på")).toBeVisible();
    await page.getByRole("button", { name: "Neste", exact: true }).click();
    await expect(page.getByRole("radiogroup", { name: "Karakter" })).toBeVisible();
    await expect(page.getByText("SKJORTE")).toHaveCount(0);
    // Three short steps, one thing on each: who, the character, and the game with the darts.
    await expect(page.getByRole("radiogroup", { name: "Spill" })).toHaveCount(0);
    await page.getByRole("button", { name: "Neste", exact: true }).click();
    // The game and the darts start as they are most likely wanted, in one line; changing them is one tap.
    await expect(page.getByText("Mikke Mus · Steel tip")).toBeVisible();
    await expect(page.getByText("Ly-cupen", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Endre" }).click();
    await expect(page.getByRole("radiogroup", { name: "Spill" })).toBeVisible();
    // The names stand alone; what a game or a pair of darts is stands behind a small i.
    await expect(page.getByText("Ned til null fra 501")).toHaveCount(0);
    await page.getByRole("button", { name: "Om 501" }).click();
    await expect(page.getByText("Ned til null fra 501")).toBeVisible();
    await page.getByRole("button", { name: "Om Soft tip" }).click();
    await expect(page.getByText(/Plastspiss/)).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((x) => x.target.join(" ")).join(" | ")}`)).toEqual([]);
    // Darts are a soft tip or a steel tip, each with its picture; steel is the start.
    await expect(page.getByRole("radio", { name: /Steel tip/ })).toBeChecked();
    await page.getByRole("radio", { name: /Soft tip/ }).click();
    await page.getByRole("radio", { name: /Soft tip/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/darts-pick.png" });
    await page.getByRole("button", { name: "Start karrieren" }).click();
    await expect.poll(async () => (await saved(page))?.profile?.character).toBe("c03");
    expect((await saved(page)).profile.darts).toBe("soft");
    expect((await saved(page)).money).toBe(2000);
    expect((await saved(page)).startLevel).toBe("sterk");
  });

  test("innstillinger: spillet kan byttes underveis, og 501 gir tall for 501 og en kamp i 501", async ({ page }) => {
    test.setTimeout(120000);
    await seed(page, { ...CAREER, money: 2000 });
    await page.getByRole("button", { name: /Lars/ }).click();
    // The game is a setting of the career: Mikke Mus to begin with, and it can be changed from the menu.
    await page.getByRole("button", { name: "Meny" }).click();
    await page.getByRole("button", { name: "Innstillinger" }).click();
    await expect(page.getByRole("radio", { name: /^Mikke Mus/ })).toBeChecked();
    await page.getByRole("radio", { name: /^501/ }).click();
    await expect(page.getByRole("switch", { name: /Dobbel ut/ })).toBeVisible();
    await expect.poll(async () => (await saved(page)).profile.game).toBe("501");
    await page.keyboard.press("Escape");
    // The pub's cup in 501: the comparison before the match has the figures of 501, not of Mikke Mus.
    await place(page, "Turneringer").click();
    await page.getByRole("list", { name: "Turneringer" }).getByRole("button", { name: /^Ly-cupen/ }).click();
    await play(page, "SPILL Ly-cupen · gratis").click();
    await page.waitForTimeout(3300);
    await play(page, "TREKK").click();
    await page.getByLabel("Trekningen").getByText("DU", { exact: true }).waitFor({ timeout: 15_000 });
    await play(page, "START").click();
    await play(page, "Start kampen").click();
    await expect(page.getByRole("row", { name: /Snitt, 3 piler/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Piler per runde/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Treffprosent/ })).toHaveCount(0);
    // The match is 501, a leg to nothing.
    await play(page, "KAST").click();
    await expect(page.getByText("501").first()).toBeVisible();
  });

  const INVITE = { id: "lu", kind: "lu", name: "Ly-sprinten", short: "Ly", trophy: "Ly-sprinten-pokalen", venue: "Ly", stage: "Invitasjon · Ly", tagline: "En kort kveld i 301", scale: 1, size: 8, fee: 0, prizes: { winner: 400, final: 250, semi: 150 }, points: { winner: 5, final: 3, semi: 2, quarter: 1 }, factor: 1.2, minutes: 30, key: "ly-sprint", city: "Ly", reason: "Puben setter opp en kort kveld i 301.", countdown: { start: 301, doubleOut: false } };
  const MSG = (id: string, title: string, offer: object, extra: object = {}) => ({ id, week: 3, from: { name: "Roger", role: "Rival" }, title, body: "Tekst", read: false, state: "open", until: 5, offer, ...extra });
  const LIFE = {
    week: 3,
    seasonPts: 0,
    reputation: 5,
    newsSeen: 0,
    sponsor: null,
    seasons: [],
    counter: 6,
    world: { drift: {}, retired: [], rookies: [], pts: {}, snap: {} },
    news: [
      { id: "n5", week: 2, kind: "cup", headline: "Haakon vant Ly-cupen", text: "Slo Marcus i finalen.", who: "Haakon" },
      { id: "n4", week: 1, kind: "world", headline: "Lars er ny på Ly", text: "Fredagscupen venter." },
    ],
    inbox: [
      MSG("m6", "Ly-sprinten", { kind: "invite", invite: INVITE }),
      MSG("m3", "Roger vil ha revansje", { kind: "challenge", game: "501", opponent: { name: "Roger", skill: 4 }, stake: 250, risk: 100 }),
    ],
  };

  test("meldinger og nyheter: merker på hjemmet, en invitasjon som tas imot, og en utfordring som sies nei til koster rykte", async ({ page }) => {
    await seed(page, { ...CAREER, life: LIFE });
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByText("Sesong 1 · uke 3")).toBeVisible();
    // One round button for it all: it has a dot, and behind it the offers come first and the news below.
    await expect(page.getByRole("button", { name: "Meldinger, nytt" })).toBeVisible();
    await page.getByRole("button", { name: /^Meldinger/ }).click();
    await expect(page.getByText("Haakon vant Ly-cupen")).toBeVisible();
    await expect(page.getByText("Uke 2", { exact: true })).toBeVisible();
    // Say no to the challenge, and the name pays for it.
    await page.getByRole("button", { name: /Roger vil ha revansje/ }).click();
    await expect(page.getByText("Ved tap: −$100")).toBeVisible();
    await page.getByRole("button", { name: "Ikke i kveld" }).click();
    await expect.poll(async () => (await saved(page)).life.reputation).toBe(4);
    // The invitation: yes signs up for it, as its own tournament.
    await page.getByRole("button", { name: /Ly-sprinten/ }).first().click();
    await expect(page.getByText("Vinner $400")).toBeVisible();
    await page.getByRole("button", { name: "Aksepter" }).click();
    // A yes does not go into the tournament: it points to the tournaments, where it waits as the next one.
    await expect.poll(async () => (await saved(page)).active?.invite?.name).toBe("Ly-sprinten");
    await page.getByRole("button", { name: "Gå til turneringer" }).click();
    await expect(page.getByText("NESTE TURNERING")).toBeVisible();
    await expect.poll(async () => (await saved(page)).active?.invite?.name).toBe("Ly-sprinten");
    expect((await saved(page)).active.cup.countdown).toEqual({ start: 301, doubleOut: false });
  });

  test("lag: World Cup of Darts spilles to og to, med én poengsum og makkeren som kaster etter deg", async ({ page }) => {
    const nations: [string, string[]][] = [["Nederland", ["Littler", "Cor Dekker"]], ["Tyskland", ["Max Hartmann", "Jonas Keller"]], ["Frankrike", ["Sofia Moreau", "Luca Dubois"]], ["Italia", ["Stefano Rossi", "Matteo Bianchi"]], ["England", ["Samuel Okafor", "Marcus Williams"]], ["Japan", ["Mei Tanaka", "Kenji Sato"]], ["Danmark", ["Jesper Holm", "Oskar Lund"]]];
    const bot = (name: string, skill: number) => ({ name, isBot: true, botLevel: String(skill), skill });
    const team = { mine: { name: "Norge", partner: "Marcus" }, others: nations.map(([name, members]) => ({ name, members })) };
    const invite = { ...INVITE, id: "vm", kind: "vm", name: "World Cup of Darts", short: "Verdensarenaen", trophy: "World Cup of Darts-pokalen", venue: "Verdensarenaen", stage: "Invitasjon · Verdensarenaen", scale: 5, size: 8, fee: 0, prizes: { winner: 45000, final: 21000, semi: 10500, quarter: 4500 }, key: "wc", city: "Verdensarenaen", countdown: { start: 501, doubleOut: true }, team };
    const entrants = [{ name: "Norge", isBot: false, members: [{ name: "Lars", isBot: false }, bot("Marcus", 4)] }, ...nations.map(([name, members]) => ({ name, isBot: false, members: members.map((m) => bot(m, 4)) }))];
    const active = { id: "a", tier: "vm", seed: 5, cost: 0, entrants, cup: { kind: "vm", name: "World Cup of Darts", trophy: "World Cup of Darts-pokalen", level: "4", growth: true, seed: 5, career: true, countdown: { start: 501, doubleOut: true } }, tournament: null, result: null, invite };
    await seed(page, { ...CAREER, points: 90, active });
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /^TREKK|^SPILL/ }).first().click();
    // The opening of a tournament, for two and two.
    await expect(page.getByRole("heading", { name: "World Cup of Darts" })).toBeVisible();
    await expect(page.getByText("Lag", { exact: true })).toBeVisible();
    // The field is ranked by strength with the player's own side in it: for the team it is the nation.
    await expect(page.getByLabel("Rangering").getByText("Norge")).toBeVisible();
    await play(page, "TREKK").click();
    await expect(page.getByLabel("Trekningen").getByText("DU", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Trekningen").getByText("Norge").first()).toBeVisible();
    await play(page, "START").click();
    await play(page, "Start kampen").click();
    await expect(page.getByRole("heading", { name: "Norge" }).or(page.getByText("Norge").first())).toBeVisible();
    await play(page, "KAST").click();
    // One score for the team; the player throws first, and the partner, a bot, throws his round by himself.
    await expect(page.getByText("Lars kaster for Norge")).toBeVisible();
    for (const d of "60") await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
    // The bots throw the next three rounds (the other team's first, Marcus, the other team's second) and it is the player's turn again.
    await expect(page.getByText(/^[A-Za-zÅØÆåøæ ]+: .+( = \d+|, over streken|, tar ut!)$/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Lars kaster for Norge")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Stilling").getByText(/Nå: Lars/)).toBeVisible();
  });

  test("tv: Utfordreren har en åpning som en turnering, viser honoraret og handicapet, og kan avslås uten å koste noe", async ({ page }) => {
    const tv = { title: "Utfordreren", honorarium: 150, legs: 1, humanStart: 201, theirStart: 301 };
    const offer = { kind: "challenge", game: "501", opponent: { name: "Littler", skill: 1 }, stake: 600, risk: 0, tv };
    const life = { ...LIFE, inbox: [MSG("m7", "Utfordreren", offer, { from: { name: "TV-selskapet", role: "TV" } })] };
    await seed(page, { ...CAREER, life });
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /^Meldinger/ }).click();
    await page.getByRole("button", { name: /Utfordreren/ }).click();
    await expect(page.getByText("Du starter på 201")).toBeVisible();
    await page.getByRole("button", { name: "Ta den" }).click();
    // The opening of a tournament, for a match: the name, who plays, the fee and the prize, and the way out.
    await expect(page.getByRole("heading", { name: "Utfordreren" })).toBeVisible();
    await expect(page.getByText("Honorar")).toBeVisible();
    await expect(page.getByText("Lars starter på 201, Littler på 301.")).toBeVisible();
    await page.getByRole("button", { name: "Avslå" }).click();
    await expect.poll(async () => (await saved(page)).challenge).toBeNull();
    expect((await saved(page)).life.reputation).toBe(5);
  });

  test("etter en turnering: uken går, nyheten om deg er skrevet, og sesongen teller", async ({ page }) => {
    const active = { id: "lars-1", tier: "lu", seed: 1, cost: 0, entrants: [], cup: { kind: "lu", name: "Ly-cupen", trophy: "Ly-pokalen", level: "4", growth: true, seed: 1, career: true }, tournament: null, result: { place: "semi", prize: 200, cost: 0, points: 3 } };
    await seed(page, { ...CAREER, active });
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /^HENT/ }).click();
    await page.getByRole("button", { name: /^HENT/ }).click();
    await expect.poll(async () => (await saved(page)).life?.week).toBe(2);
    const c = await saved(page);
    // The prize is paid when the cup is finished, which the seeded result has already been through.
    expect(c.money).toBe(300);
    expect(c.life.seasonPts).toBe(3);
    expect(c.life.news.some((n: { kind: string; headline: string }) => n.kind === "you" && n.headline.includes("tapte semifinalen"))).toBe(true);
    await expect(page.getByText("Sesong 1 · uke 2")).toBeVisible();
  });

  test("hjemmet: rommet, saldo og nivå, ett mål, én stor knapp og fire runde", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    // Home is the hall of the biggest step reached (the pub at the start); the room itself is on its own screen.
    await expect(page.locator(".room-backdrop-img")).toHaveAttribute("src", /hub-lu.jpg/);
    // The character stands in the room (the career in the seed has none saved: it gets the one there is), and the profile has its face.
    await expect(page.locator(".char-home .char-figure-img")).toHaveAttribute("src", /c03.noytral/);
    // It says where the player is: the room is a place with a name and a step.
    // The top is the goal and the season; the room has its own screen, and a shelf of cups only once there is a cup to put on it.
    await expect(page.getByText(/Sesong 1 · uke 1/)).toBeVisible();
    await expect(page.getByRole("img", { name: /Pokalhylle/ })).toHaveCount(0);
    const hud = page.getByRole("group", { name: "Status" });
    await expect(hud.getByText("$300")).toBeVisible();
    // The level is on the profile, not on the home screen: the rank is written under the name here.
    await expect(hud.getByLabel(/^Nivå/)).toHaveCount(0);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByText("Pubspiller", { exact: true })).toBeVisible();
    // The one big button leads to the biggest step that can be entered, with the price as a small line.
    await expect(play(page, "SPILL Ly · gratis")).toBeVisible();
    await place(page, "Profil").click();
    await expect(page.getByRole("progressbar", { name: "Neste rang: Regionspiller" })).toBeVisible();
    await page.getByRole("button", { name: "Tilbake" }).click();
    // Four round buttons. The room has no dot: the first step costs $500 and there is $300.
    for (const name of ["Trening", "Profil", "Turneringer", "Meldinger"] as const) await expect(place(page, name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Trening, nytt" })).toHaveCount(0);
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
    await expect(page.getByLabel("Trekningen").getByText("DU", { exact: true })).toBeVisible({ timeout: 15_000 });
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
    await expect(page.getByText("DIN SJANSE")).toBeVisible();
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

  test("utfordring: kommer som melding, vis innsatsen, spill, og gi opp uten å tape noe", async ({ page }) => {
    const life = { ...LIFE, inbox: [LIFE.inbox[1]] };
    await seed(page, { ...CAREER, life });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Meldinger").click();
    await page.getByRole("button", { name: /Roger vil ha revansje/ }).click();
    await page.getByRole("button", { name: "Ta den" }).click();
    // The two of them and the stake, and one button.
    await expect(page.getByText("$250", { exact: true })).toBeVisible();
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

  test("utstyr: piler, trener og reise kjøpes under treningen, hvert trinn med prisen på knappen, og regnskapet får dem", async ({ page }) => {
    await seed(page, { ...CAREER, money: 5000, life: { ...LIFE, inbox: [] } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Trening").click();
    const gear = page.getByRole("list", { name: "Utstyr" });
    await expect(gear.getByText("PILER · Messingpiler")).toBeVisible();
    await expect(gear.getByText("TRENER · Ingen trener")).toBeVisible();
    await expect(gear.getByText("REISE · Til fots")).toBeVisible();
    await gear.getByRole("button", { name: "Kjøp Wolfram 80 %, $400" }).click();
    await expect.poll(async () => (await saved(page)).gear?.darts).toBe(1);
    expect((await saved(page)).money).toBe(4600);
    await expect(gear.getByText("PILER · Wolfram 80 %")).toBeVisible();
    await gear.getByRole("button", { name: "Kjøp Togkort, $600" }).click();
    await expect.poll(async () => (await saved(page)).gear?.travel).toBe(1);
    // The books have both, under their own heading.
    const c = await saved(page);
    expect(c.ledger.filter((e: { kind: string }) => e.kind === "gear").map((e: { label: string; amount: number }) => [e.label, e.amount])).toEqual([["Piler: Wolfram 80 %", -400], ["Reise: Togkort", -600]]);
    // Too little for the next darts: the button is there, but not to press.
    await expect(gear.getByRole("button", { name: "Kjøp Wolfram 90 %, $1 500" })).toBeEnabled();
    await expect(gear.getByRole("button", { name: "Kjøp Mental trener, $8 000" })).toHaveCount(0);
  });

  test("trening: bildet av rommet og to knapper, og oppgraderingen kjøpes i et eget vindu", async ({ page }) => {
    await seed(page, { ...CAREER, money: 1100 });
    await page.getByRole("button", { name: /Lars/ }).click();
    // There is money for the first step: the training button has a dot.
    await expect(page.getByRole("button", { name: "Trening, nytt" })).toBeVisible();
    await place(page, "Trening").click();
    await expect(page.getByRole("img", { name: "Rommet ditt, trinn 2: Ryddet" })).toBeVisible();
    // The room is a picture and a button for more; what the next step gives is behind the button.
    await page.getByRole("button", { name: "Oppgrader" }).click();
    // The window is the room it becomes, and a button with the price: no lists, no words of what is missing.
    await expect(page.getByRole("img", { name: /Rommet etter oppgraderingen/ })).toBeVisible();
    await expect(page.getByText("Oppgrader til nivå 3")).toBeVisible();
    await play(page, "KJØP $1 000").click();
    await expect.poll(async () => (await saved(page)).room).toBe(2);
    expect((await saved(page)).money).toBe(100);
    await expect(page.getByRole("img", { name: "Rommet ditt, trinn 3: Nye vegger" })).toBeVisible();
    // The room can be compared as it was and as it is.
    await page.getByRole("button", { name: "Før og etter" }).click();
    await expect(page.getByRole("slider", { name: /sammenligne/ })).toBeVisible();
    await page.getByRole("button", { name: "Lukk sammenligningen" }).click();
    // Back at home the new thing is named for a while.
    await page.getByRole("button", { name: "Tilbake" }).click();
    await expect(page.getByRole("button", { name: /Nytt i rommet: Maling og veggpaneler/ })).toBeVisible();
    await place(page, "Trening").click();
    // The next step costs $2 000: too much, so the button in the window is shut.
    await page.getByRole("button", { name: "Oppgrader" }).click();
    await expect(play(page, /^KJØP .*2.000/)).toBeDisabled();
  });

  test("rommet er ferdig på det siste trinnet", async ({ page }) => {
    await seed(page, { ...CAREER, room: 9, money: 100000 });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Trening").click();
    await expect(page.getByRole("img", { name: "Rommet ditt, trinn 10: Drømmerommet" })).toBeVisible();
    await page.getByRole("button", { name: "Oppgrader" }).click();
    await expect(page.getByText("Drømmerommet er på plass.")).toBeVisible();
  });

  test("trening: dagens øvelse er trippel 20, femten runder flytter nivået, og det blir lagret", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-02T12:00:00Z"));
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Trening").click();
    await page.getByRole("button", { name: "Dagens øvelse: Trippel 20" }).click();
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

  test("trening: dagens øvelse betaler 100 dollar én gang, og er ferdig resten av dagen", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-01T12:00:00Z"));
    await seed(page, { ...CAREER, room: 3 });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Trening").click();
    const upgradeY = (await page.getByRole("button", { name: "Oppgrader" }).boundingBox())!.y;
    expect(upgradeY).toBeLessThan((await page.getByRole("button", { name: /^Dagens øvelse:/ }).boundingBox())!.y);
    await expect(page.getByText("+$100", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dagens øvelse: Tre 20 på tre piler" }).click();
    await page.getByRole("button", { name: "3 treff" }).click();
    await expect(page.getByText("Bestått")).toBeVisible();
    await expect(page.getByText(/Dagens øvelse: \+\$100 · 1 dag på rad/)).toBeVisible();
    await expect.poll(async () => (await saved(page)).money).toBe(400);
    await play(page, "OK").click();
    await place(page, "Trening").click();
    await expect(page.getByText("ferdig", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Dagens øvelse:/ })).toHaveCount(0);
  });

  test("trening: stigen har hundre nivåer, hvert nivå betaler 50, og rommet setter taket", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Trening").click();
    await expect(page.getByText("NIVÅ 1 AV 100")).toBeVisible();
    await expect(page.getByText("Minst 40p")).toBeVisible();
    await expect(page.getByText("+$50", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Stigen, nivå 1" }).click();
    const keys = page.getByRole("group", { name: "Tastatur" });
    // Thirty is not enough for the first level; the player may try again.
    await keys.getByRole("button", { name: "3", exact: true }).click();
    await keys.getByRole("button", { name: "0", exact: true }).click();
    await expect(page.getByText("Du fikk 30. Prøv igjen.")).toBeVisible();
    await keys.getByRole("button", { name: "4", exact: true }).click();
    await keys.getByRole("button", { name: "5", exact: true }).click();
    await expect(page.getByText("Nivå 1 klart")).toBeVisible();
    await expect.poll(async () => (await saved(page)).money).toBe(350);
    expect((await saved(page)).climb.level).toBe(2);
    await play(page, "NESTE NIVÅ").click();
    await expect(page.getByRole("heading", { name: "Nivå 2" })).toBeVisible();
  });

  test("trening: når rommet ikke tillater mer, er stigen låst", async ({ page }) => {
    await seed(page, { ...CAREER, climb: { level: 21 } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Trening").click();
    await expect(page.getByRole("button", { name: "Stigen, nivå 21" })).toBeDisabled();
  });

  test("profil: tre faner, og pokalskapet åpnes fra et merke på hjemmet", async ({ page }) => {
    const trophies = [{ tier: "lu", at: "2026-10-20T20:00:00Z", prize: 100 }, { tier: "lu", at: "2026-10-05T20:00:00Z", prize: 100 }];
    await seed(page, { ...CAREER, trophies, life: { ...LIFE, inbox: [] } });
    await page.getByRole("button", { name: /Lars/ }).click();
    // Only a chip with the number of cups; no shelf of locked ones above the big button.
    await expect(page.getByRole("img", { name: /Pokalhylle/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Pokalskapet, 2 pokaler" }).click();
    await expect(page.getByRole("tab", { name: "Pokaler" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("group", { name: /^Pokalskapet: 1 av 5/ })).toBeVisible();
    await page.getByRole("tab", { name: "Sesonger" }).click();
    await expect(page.getByRole("tabpanel", { name: "Sesonger" })).toBeVisible();
    await page.getByRole("tab", { name: "Oversikt" }).click();
    await expect(page.getByRole("progressbar", { name: /^Neste rang/ })).toBeVisible();
  });

  test("rangoppgang: en ny rang får sitt eget skjermbilde, og bare én gang", async ({ page }) => {
    await seed(page, { ...CAREER, points: 12, life: { ...LIFE, inbox: [], rankSeen: "Pubspiller" } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByText("NY RANG")).toBeVisible();
    await expect(page.getByText("Regionspiller", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "FORTSETT" }).click();
    await expect(page.getByText("NY RANG")).toHaveCount(0);
    await expect.poll(async () => (await saved(page)).life.rankSeen).toBe("Regionspiller");
    await page.reload();
    await page.getByRole("button", { name: "Karriere" }).click();
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByText("NY RANG")).toHaveCount(0);
  });

  test("sesongoppsummering: tabellen med plasseringen din og hvor mange plasser du gikk opp", async ({ page }) => {
    const seasons = [
      { season: 2, rank: 2, points: 31, prize: 150, winner: "Haakon", table: [{ name: "Haakon", pts: 33 }, { name: "Lars", pts: 31 }, { name: "Marcus", pts: 28 }, { name: "Roger", pts: 24 }, { name: "Dan", pts: 18 }] },
      { season: 1, rank: 4, points: 21, prize: 0, winner: "Haakon" },
    ];
    await seed(page, { ...CAREER, life: { ...LIFE, inbox: [], recapSeen: 1, seasons } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await expect(page.getByText("Nr. 2")).toBeVisible();
    await expect(page.getByRole("list", { name: "Sesongtabellen" }).getByText("Marcus")).toBeVisible();
    await expect(page.getByText("Du gikk opp 2 plasser fra sesong 1")).toBeVisible();
  });

  test("åpning: feltet med favorittene og hvor du står", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await play(page, /^SPILL/).click();
    await expect(page.getByRole("list", { name: "Om turneringen" })).toBeVisible();
    await expect(page.getByLabel("Rangering").getByText("Lars")).toBeVisible();
  });

  test("sesongen: stripen på hjemmet åpner tabellen, finalen og det som utløper", async ({ page }) => {
    await seed(page, { ...CAREER, life: { ...LIFE, world: { ...LIFE.world, pts: { Haakon: 22, Marcus: 15 } }, seasonPts: 18 } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /^Sesongen:/ }).click();
    await expect(page.getByText("FINALEN")).toBeVisible();
    await expect(page.getByText(/^Om \d+ uker?$/)).toBeVisible();
    const table = page.getByRole("list", { name: "Sesongtabellen nå" });
    await expect(table.getByText("Haakon")).toBeVisible();
    await expect(table.getByText("Lars (deg)")).toBeVisible();
    await expect(page.getByText("UTLØPER SNART")).toBeVisible();
    await expect(page.getByText("Ly-sprinten")).toBeVisible();
  });

  test("åpning: sett før er den rask, og knappen er der etter under ett sekund", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mikke-mus-openings", JSON.stringify(["lu"])));
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await play(page, /^SPILL/).click();
    await expect(page.getByRole("heading", { name: "Ly-cupen" })).toBeVisible();
    await expect(play(page, "TREKK")).toBeVisible({ timeout: 1800 });
  });

  test("resultat: to rader under premien, og resten bak en knapp", async ({ page }) => {
    const sponsor = { name: "Hansens Rør", perEvent: 80, need: "quarter", events: 4, left: 3, misses: 0, earned: 0 };
    const active = { id: "lars-1", tier: "region", seed: 1, cost: 200, entrants: [], cup: { kind: "region", name: "Regionmesterskapet", trophy: "Regionpokalen", level: "4", growth: true, seed: 1, career: true }, tournament: null, result: { place: "winner", prize: 2500, cost: 200, points: 8, revenge: { names: ["Dan"], bonus: 100 } } };
    await seed(page, { ...CAREER, titles: 1, active, life: { ...LIFE, inbox: [], sponsor } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /^HENT/ }).click();
    const rows = page.getByRole("list", { name: "Nytt" });
    await expect(rows.getByRole("status")).toHaveCount(2);
    await page.getByRole("button", { name: /^\+ \d til$/ }).click();
    await expect(rows.getByRole("status")).toHaveCount(3);
  });

  test("profil: sesongen som tall og prikker, rival bare etter at dere har møttes, treningsrom og meritter", async ({ page }) => {
    await seed(page, { ...CAREER, life: { ...LIFE, inbox: [], seasonPts: 0 } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Profil").click();
    // The season is its number and ten dots, three of them marked; the name (rykte) is one row of ten dots too; nothing on development or darts.
    await expect(page.getByRole("img", { name: "Uke 3 av 10" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Rykte 5 av 10" })).toBeVisible();
    await expect(page.getByText("Utvikling")).toHaveCount(0);
    await expect(page.getByText("Piler", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Treningsrom")).toBeVisible();
    // Not met: only a button to choose one; a chosen rival shows with a button to challenge.
    await page.getByRole("button", { name: "Velg rival" }).click();
    await page.getByRole("button", { name: "Dave" }).click();
    expect((await saved(page)).life.rivalPick).toBe("Dave");
    await page.getByRole("button", { name: /^Dave/ }).click();
    await page.getByRole("button", { name: "Utfordre til duell" }).click();
    await expect.poll(async () => (await saved(page)).challenge?.opponent?.name).toBe("Dave");
    // On to the duel: its opening, with the button to play.
    await expect(play(page, "SPILL")).toBeVisible();
  });

  test("meritter: en liste med hva som er gjort og hva som gjenstår", async ({ page }) => {
    await seed(page, { ...CAREER, played: 6, best: { lu: "winner", nm: "semi" }, life: { ...LIFE, inbox: [] } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Profil").click();
    // The row says the best that has been done (the highest cup reached), and the list holds the best of each cup.
    await page.getByRole("button", { name: "Norgesmesterskapet: Semifinale ›" }).click();
    await expect(page.getByText("Best: Semifinale")).toBeVisible();
    await expect(page.getByText("Best: Vinner")).toBeVisible();
    await expect(page.getByText("Første turnering", { exact: true })).toBeVisible();
    await expect(page.getByText("Fem turneringer", { exact: true })).toBeVisible();
    await expect(page.getByText("Drømmerommet", { exact: true })).toBeVisible();
  });

  test("regnskap: pengene øverst åpner siste uke og totalt", async ({ page }) => {
    await seed(page, { ...CAREER, ledger: [{ week: 3, kind: "prize", label: "Premie: Ly-cupen", amount: 500 }, { week: 3, kind: "fee", label: "Innskudd: Regionmesterskapet", amount: -200 }], life: { ...LIFE, inbox: [] } });
    await page.getByRole("button", { name: /Lars/ }).click();
    await page.getByRole("button", { name: /^Regnskap, saldo/ }).click();
    await expect(page.getByText("Premie: Ly-cupen")).toBeVisible();
    await expect(page.getByText("Innskudd: Regionmesterskapet")).toBeVisible();
    await page.getByRole("tab", { name: "Totalt" }).click();
    await expect(page.getByRole("list", { name: "Fordelt" }).getByText("Premier")).toBeVisible();
    await expect(page.getByText("Resultat")).toBeVisible();
  });

  test("rangering: hele listen kan rulles, og den som er best ligger først", async ({ page }) => {
    await toCareer(page);
    await page.getByRole("button", { name: /Lars/ }).click();
    await place(page, "Profil").click();
    await page.getByRole("tab", { name: "Rangering" }).click();
    const rows = page.getByRole("list", { name: "Verdensrangering" }).getByRole("listitem");
    expect(await rows.count()).toBeGreaterThan(30);
    await expect(page.getByText(/^Du er nr\. \d+$/)).toBeVisible();
  });

  test("menyen: slett karrieren ligger bak de tre prikkene, og slett sier hva det koster", async ({ page }) => {
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
    for (const tab of ["Turneringer", "Trening", "Profil", "Meldinger"] as const) {
      await place(page, tab).click();
      await page.waitForTimeout(700);
      await check();
      await page.getByRole("button", { name: "Tilbake" }).click();
    }
  });
});
