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
    const places = page.getByRole("radiogroup", { name: "Sted" });
    // Four players fit a pub; another place can be picked.
    await expect(places.getByRole("radio", { name: /^Ly/ })).toBeChecked();
    await places.getByRole("radio", { name: /Rompuben Moss/ }).click();
    await page.getByRole("button", { name: "Neste", exact: true }).click();
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

  test("mot boter: EM spilles i Civic Hall, og favorittene har portrett", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Turnering" }).first().click();
    await addPlayers(page, ["Lars", "Vadla"]);
    await page.getByRole("radio", { name: /Mot boter/ }).click();
    await page.getByRole("radio", { name: /EM i dart/ }).click();
    await expect(page.getByRole("radiogroup", { name: "Sted" }).getByRole("radio", { name: /Civic Hall/ })).toBeChecked();
    await page.getByRole("button", { name: "Neste", exact: true }).click();
    await expect(page.getByRole("heading", { name: "EM i dart" })).toBeVisible();
    await page.getByRole("button", { name: "TREKK" }).click({ timeout: 10_000 });
    await expect(page.getByLabel("Favoritter")).toBeVisible({ timeout: 15_000 });
    // Three favourites, each a portrait with a name, and no ranking number under them.
    await expect(page.getByLabel("Favoritter").locator("img").first()).toBeVisible();
    await expect(page.getByLabel("Favoritter").getByText(/^#\d+/)).toHaveCount(0);
  });
});
