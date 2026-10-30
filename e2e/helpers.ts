import { expect, type Page } from "@playwright/test";

/** The code of the app, from the environment: the tests that need to get in are skipped without it. */
export const PIN = process.env.E2E_PIN;
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

/** The screens that are their own address, as the tests walk them. */
export const SCREENS: { name: string; path: string }[] = [
  { name: "forside", path: "/" },
  { name: "spillere", path: "/spillere" },
  { name: "statistikk", path: "/statistikk" },
  { name: "hall-of-fame", path: "/hall-of-fame" },
  { name: "mer", path: "/mer" },
  { name: "innstillinger", path: "/innstillinger" },
  { name: "storskjerm", path: "/storskjerm" },
  { name: "stilark", path: "/design" },
];

type Options = {
  /** Show the welcome (a device that has seen nothing) instead of skipping it. */
  welcomed?: boolean;
  /** What the database answers: an empty list (default), or nothing at all, as with no network. */
  database?: "empty" | "offline";
};

/**
 * Opens the app on this machine's dev server with nothing from the database in it, in the theme asked for, and gets past the
 * keypad with the code from E2E_PIN. Every call to Supabase is answered with an empty list (or refused, for the offline case), so
 * the screens show their empty or failed states and do not change when a match is played.
 */
export async function openApp(page: Page, theme: Theme, { welcomed = true, database = "empty" }: Options = {}) {
  await page.route(/supabase\.co/, (route) => (database === "offline" ? route.abort("internetdisconnected") : route.fulfill({ status: 200, contentType: "application/json", body: "[]" })));
  await page.addInitScript(
    ([t, w]) => {
      // The grain is a separate matter, and a quiet front page keeps the pictures the same.
      localStorage.setItem("mikke-mus-texture", "0");
      localStorage.setItem("mikke-mus-fx-level", "normal");
      localStorage.setItem("mikke-mus-theme", t);
      if (w === "1") localStorage.setItem("mikke-mus-welcomed", "1");
    },
    [theme, welcomed ? "1" : "0"],
  );
  await page.goto("/");
  // Either the keypad or the app is on the page once it has loaded; the keypad is answered, the app is left alone.
  const gate = page.getByText("Skriv inn koden");
  await gate.or(page.getByRole("navigation", { name: "Hovedmeny" })).or(page.getByRole("button", { name: "Hopp over" })).first().waitFor({ timeout: 30_000 });
  if (await gate.isVisible()) {
    for (const digit of PIN!) await page.getByRole("button", { name: digit, exact: true }).first().click();
    await expect(page.getByText("Skriv inn koden")).toBeHidden({ timeout: 20_000 });
    await page.waitForTimeout(400);
  }
}

/** Gets past what stands between the start of a match and its board: the rules the first time, and the cards before the match (Fortsett). */
export async function startPast(page: Page) {
  const skip = page.getByRole("button", { name: "Hopp over" });
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click();
  const cards = page.getByRole("dialog", { name: "Oppstilling" });
  if (await cards.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cards.getByRole("button", { name: "Fortsett" }).click();
    await expect(cards).toBeHidden();
  }
}

/** Starts the match, and picks the first side in «Hvem starter?» when a game asks (the main match does not). */
export async function startMatch(page: Page) {
  await page.getByRole("button", { name: "Start kampen" }).click();
  await chooseStarter(page);
}

/** Answers «Hvem starter?» with the first side, if it is asked. */
export async function chooseStarter(page: Page) {
  const ask = page.getByRole("dialog", { name: /starter\?$/ });
  if (await ask.isVisible({ timeout: 1500 }).catch(() => false)) await ask.getByRole("list", { name: "Hvem starter" }).getByRole("button").first().click();
}
