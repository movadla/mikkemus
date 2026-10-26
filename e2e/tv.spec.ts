import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp } from "./helpers";
import type { LiveShow } from "../lib/liveMatch";

/** The big screen with a draw or a champion sent from the tournament, instead of a match. The database is answered by the test. */
async function showOnTv(page: Page, show: LiveShow) {
  await openApp(page, "dark");
  // Later routes win: the live match is the show, everything else stays an empty list.
  await page.route(/live_match/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: { screen: "setup", players: [], progress: {}, activePlayer: null, turnToken: 0, winner: null, botLevels: {}, guestPlayers: {}, show } }) }),
  );
  await page.goto("/storskjerm");
}

test.describe("storskjermen som sending", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("trekningen viser parene etter hverandre, i pokalens farge", async ({ page }) => {
    await showOnTv(page, {
      kind: "draw",
      key: 1,
      title: "VM i dart",
      cup: { kind: "vm", name: "VM i dart", trophy: "Verdensmesterpokalen" },
      pairs: [
        { a: "Lars", b: "Moen" },
        { a: "Vadla", b: "Hans" },
        { a: "Monge", b: null },
        { a: "Sondre", b: "Charlotte" },
      ],
    });
    await expect(page.getByRole("heading", { name: "Trekning: VM i dart" })).toBeAttached();
    await expect(page.getByText("Verdensmesterpokalen")).toBeVisible();
    // All four are in the list once the draw has played out (a few seconds).
    await expect(page.getByText("Sondre")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Walkover")).toBeVisible();
  });

  test("mesteren får en scene med pallen og prisene", async ({ page }) => {
    await showOnTv(page, {
      kind: "champion",
      title: "VM i dart",
      cup: { kind: "vm", name: "VM i dart", trophy: "Verdensmesterpokalen" },
      winner: "Vadla",
      trophy: "Verdensmesterpokalen",
      prizes: [{ title: "Beste snitt", name: "Lars", detail: "61,2 per tur" }],
      podium: ["Vadla", "Lars", "Moen"],
    });
    await expect(page.getByRole("heading", { name: "Mester: Vadla" })).toBeAttached();
    await expect(page.getByLabel("Pallen")).toContainText("Lars");
    await expect(page.getByLabel("Utmerkelser")).toContainText("Beste snitt");
    await page.screenshot({ path: "test-results/tv-champion.png" });
  });
});
