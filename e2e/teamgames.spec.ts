import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp, startMatch } from "./helpers";

/** Lag i 301/501, Highstriker og Lava: ett lag har én poengsum eller de samme livene, og medlemmene kaster en runde hver, etter tur. */
const NAMES = ["Lars og Per", "Ola og Kari"];

async function begin(page: Page, game: string) {
  await page.addInitScript((list) => {
    localStorage.setItem("mikke-mus-team-cards", JSON.stringify(list.map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }))));
  }, NAMES);
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: game }).click();
  await page.getByRole("radio", { name: "Lag" }).click();
  const group = page.getByRole("group", { name: "Lag" });
  for (const n of NAMES) await group.getByRole("button", { name: new RegExp(n) }).click();
  await startMatch(page);
}
const keys = async (page: Page, digits: string) => {
  for (const d of digits) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
};
const side = (page: Page, name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });

test.describe("lagspill i de andre spillene", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("301/501: ett tall for laget, og makkerne kaster hver sin runde", async ({ page }) => {
    await begin(page, "301 / 501");
    await expect(side(page, "Lars og Per")).toContainText("Nå: Lars");
    await keys(page, "60");
    await expect(side(page, "Lars og Per")).toContainText("441");
    await expect(side(page, "Ola og Kari")).toContainText("Nå: Ola");
    await keys(page, "45");
    // Back to the first team: the second of them throws.
    await expect(side(page, "Lars og Per")).toContainText("Nå: Per");
  });

  test("Highstriker: laget har livene sammen, og makkerne kaster hver sin runde", async ({ page }) => {
    await begin(page, "Highstriker");
    await expect(side(page, "Lars og Per")).toContainText("Nå: Lars");
    await keys(page, "60");
    await expect(side(page, "Ola og Kari")).toContainText("Nå: Ola");
    await keys(page, "50");
    await expect(side(page, "Ola og Kari").getByRole("img", { name: /liv igjen/ })).toHaveAttribute("aria-label", "2 av 3 liv igjen");
    await expect(side(page, "Lars og Per")).toContainText("Nå: Per");
  });

  test("Lava: laget har livene sammen, og makkerne kaster tre piler hver", async ({ page }) => {
    await begin(page, "Lava");
    await expect(page.getByRole("status")).toContainText("Lars kaster");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Bom", exact: true }).click();
    await expect(page.getByText(/Ola for Ola og Kari · pil 1 av 3/)).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Bom", exact: true }).click();
    await expect(page.getByText(/Per for Lars og Per · pil 1 av 3/)).toBeVisible();
  });
});
