import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp, startMatch } from "./helpers";

/** Andre spill under Statistikk: the tab is there once 301/501, Highstriker or Lava has been played, and a finished game writes its result. */
const result = (id: string, game: string, winner: string, loser: string) => ({
  data: {
    id,
    game,
    playedAt: new Date().toISOString(),
    winner,
    players: [winner, loser],
    bots: [],
    figures: {
      [winner]: { darts: 24, points: 301, rounds: 8, best: 140, tons: 2, burned: 5, lostLives: 1, finish: 80 },
      [loser]: { darts: 24, points: 200, rounds: 8, best: 100, tons: 1, burned: 3, lostLives: 3 },
    },
  },
});

/** The database answers game_results with these rows, and the requests that write to it are kept. */
async function withResults(page: Page, rows: unknown[]) {
  const writes: string[] = [];
  await page.route(/game_results/, (route) => {
    const method = route.request().method();
    if (method !== "GET") writes.push(method);
    return route.fulfill({ status: 200, contentType: "application/json", body: method === "GET" ? JSON.stringify(rows) : "[]" });
  });
  return writes;
}

test.describe("statistikk for de andre spillene", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("fanen er borte til et spill er spilt", async ({ page }) => {
    await openApp(page, "dark");
    await page.goto("/statistikk");
    await expect(page.getByRole("radio", { name: "Spillere" })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Andre spill")).toHaveCount(0);
  });

  test("viser bare spillene som er spilt", async ({ page }) => {
    await openApp(page, "dark");
    await withResults(page, [result("a", "301", "Lars", "Vadla"), result("b", "301", "Vadla", "Lars"), result("c", "lava", "Lars", "Vadla")]);
    await page.goto("/statistikk");
    await page.getByText("Andre spill").first().click();
    await expect(page.getByRole("region", { name: "301" })).toContainText("Lars");
    await expect(page.getByRole("region", { name: "301" })).toContainText("2 spill");
    await expect(page.getByRole("region", { name: "Lava" })).toContainText("brent");
    await expect(page.getByRole("region", { name: "501" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Highstriker" })).toHaveCount(0);
    await page.screenshot({ path: "test-results/andre-spill.png" });
  });

  test("et ferdig spill skrives, og Angre tar resultatet tilbake", async ({ page }) => {
    await openApp(page, "dark");
    const writes = await withResults(page, []);
    await page.getByRole("button", { name: "Andre spill" }).click();
    await page.getByRole("button", { name: "301 / 501" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("radio", { name: "301" }).click();
    await startMatch(page);
    const keys = async (digits: string) => {
      for (const d of digits) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
    };
    await keys("180");
    await keys("60");
    await keys("121");
    await page.getByRole("dialog", { name: "Hvor mange piler tok siste runde?" }).getByRole("button", { name: "2 piler" }).click();
    await expect(page.getByRole("heading", { name: "Lars" })).toBeVisible();
    await expect.poll(() => writes).toContain("POST");
    expect(writes.filter((w) => w === "DELETE")).toHaveLength(0);
    await page.getByRole("button", { name: "Angre siste runde" }).click();
    await expect.poll(() => writes).toContain("DELETE");
  });
});
