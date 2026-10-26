import { expect, test, type Page } from "@playwright/test";

/**
 * A picture of each main screen, in the dark theme and in Dag, with nothing from the database in it: every call to Supabase is
 * answered with an empty list, so the screens show their empty states and the pictures do not change when a match is played.
 * Run with the code of the app in E2E_PIN (the tests are skipped without it): `E2E_PIN=... npm run test:visual`.
 */
const PIN = process.env.E2E_PIN;
const THEMES = ["dark", "light"] as const;

async function openApp(page: Page, theme: (typeof THEMES)[number], { welcomed = true }: { welcomed?: boolean } = {}) {
  await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
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

const SCREENS: { name: string; path: string }[] = [
  { name: "forside", path: "/" },
  { name: "spillere", path: "/spillere" },
  { name: "statistikk", path: "/statistikk" },
  { name: "hall-of-fame", path: "/hall-of-fame" },
  { name: "mer", path: "/mer" },
  { name: "innstillinger", path: "/innstillinger" },
  { name: "storskjerm", path: "/storskjerm" },
];

test.describe("skjermbilder", () => {
  test.skip(!PIN, "E2E_PIN is not set");
  for (const theme of THEMES) {
    for (const s of SCREENS) {
      test(`${s.name} (${theme})`, async ({ page }) => {
        await openApp(page, theme);
        if (s.path !== "/") await page.goto(s.path);
        await page.waitForTimeout(800);
        await expect(page).toHaveScreenshot(`${s.name}-${theme}.png`, { fullPage: false });
      });
    }

    test(`oppsett av turnering (${theme})`, async ({ page }) => {
      await openApp(page, theme);
      await page.getByRole("button", { name: "Turnering" }).first().click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`turnering-oppsett-${theme}.png`);
    });

    test(`oppsett av enkeltkamp (${theme})`, async ({ page }) => {
      await openApp(page, theme);
      await page.getByRole("button", { name: "Ny kamp" }).click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`enkeltkamp-oppsett-${theme}.png`);
    });

    test(`velkomst (${theme})`, async ({ page }) => {
      await openApp(page, theme, { welcomed: false });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`velkomst-${theme}.png`);
    });
  }
});
