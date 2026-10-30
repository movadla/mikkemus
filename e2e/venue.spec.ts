import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** A tournament played outside the career: it is played in a place, with an opening, a picture behind the draw and the faces of the bots. */
async function addPlayers(page: Page, names: string[]) {
  for (const n of names) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(n);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
}

test.describe("sted for turneringen", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("vanlig turnering: stedet velges, åpningen sier hvor, og trekningen ligger over bildet av stedet", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Turnering" }).first().click();
    await addPlayers(page, ["Lars", "Vadla", "Moen", "Hans"]);
    // The place is on the screen, with the one chosen marked.
    const places = page.getByRole("radiogroup", { name: "Sted" });
    // Four players fit a pub; another place can be picked.
    await expect(places.getByRole("radio", { name: /^Ly/ })).toBeChecked();
    await places.getByRole("radio", { name: /Rompuben Moss/ }).click();
    await page.getByRole("button", { name: /^Neste · \d+ spillere?$/ }).click();
    // The opening: the name of the place and the trophy, then on to the draw.
    await expect(page.getByRole("list", { name: "Om turneringen" }).getByText("Rompuben Moss")).toBeVisible();
    await expect(page.getByLabel("Feltet")).toBeVisible();
    await page.getByRole("button", { name: "TREKK" }).waitFor({ timeout: 10_000 });
    const check = async () => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((x) => x.target.join(" ")).join(" | ")}`)).toEqual([]);
    };
    await check();
    await page.getByRole("button", { name: "TREKK" }).click();
    await expect(page.getByRole("heading", { name: "Trekning" })).toBeVisible();
    await page.waitForTimeout(5000);
    await check();
    await expect(page.locator(".room-backdrop-img")).toHaveAttribute("src", /region-inside/);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    // The place is kept for the tournament, on this device.
    await expect.poll(async () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("mikke-mus-venues") ?? "{}")))).toContain("region");
  });

  test("mot boter: Grand Slam spilles i Civic Hall, og favorittene har portrett", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Turnering" }).first().click();
    await addPlayers(page, ["Lars", "Vadla"]);
    await page.getByRole("radio", { name: /Mot boter/ }).click();
    // The cups are the ones of the career, the smallest first; there is no European championship.
    await expect(page.getByRole("radio", { name: /Ly-cupen|Regionmesterskapet|Norgesmesterskapet|Grand Slam|VM i dart|Ly Pilotturnering/ })).toHaveCount(6);
    await expect(page.getByRole("radio", { name: /EM i dart/ })).toHaveCount(0);
    await page.getByRole("radio", { name: /Grand Slam/ }).click();
    // A cup against bots has its choices on the screen; the place follows the cup.
    // The place belongs to the cup: there is nothing to choose, and the opening says where it is played.
    await expect(page.getByRole("radiogroup", { name: "Sted" })).toHaveCount(0);
    await page.getByRole("button", { name: /^Neste · \d+ spillere?$/ }).click();
    await expect(page.getByRole("heading", { name: "Grand Slam" })).toBeVisible();
    await page.getByRole("button", { name: "TREKK" }).click({ timeout: 10_000 });
    await expect(page.getByLabel("Favoritter")).toBeVisible({ timeout: 15_000 });
    // Three favourites, each a portrait with a name, and no ranking number under them.
    await expect(page.getByLabel("Favoritter").locator("img").first()).toBeVisible();
    await expect(page.getByLabel("Favoritter").getByText(/^#\d+/)).toHaveCount(0);
  });

  test("enkeltkamp: stedet velges under Avanserte innstillinger (Ly som standard), og følger kampen", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Ny kamp" }).click();
    await addPlayers(page, ["Lars", "Vadla"]);
    await page.getByRole("switch", { name: /Avanserte innstillinger/ }).click();
    const places = page.getByRole("radiogroup", { name: "Sted" });
    await expect(places.getByRole("radio", { name: /^Ly/ })).toBeChecked();
    await places.getByRole("radio", { name: /Civic Hall/ }).click();
    await page.getByRole("button", { name: /Start/ }).first().click();
    // The place is kept with the match, so the cup of the place is on the winner screen after a reload too.
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("mikke-mus-active-match") ?? "{}").venue)).toBe("gs");
  });
});
