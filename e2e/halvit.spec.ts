import { expect, test, type Page } from "@playwright/test";
import { PIN, openApp, startMatch } from "./helpers";

/** Halv It: ti runder med hvert sitt mål. Treff og poengene legges til, bom og hele poengsummen halveres (rundet opp). */
async function begin(page: Page, players = ["Lars", "Vadla"]) {
  await openApp(page, "dark");
  await page.getByRole("button", { name: "Andre spill" }).click();
  await page.getByRole("button", { name: "Halv It" }).click();
  for (const name of players) {
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill(name);
    await page.getByRole("button", { name: "Legg til" }).click();
  }
  await startMatch(page);
}
const keys = async (page: Page, digits: string) => {
  for (const d of digits) await page.getByRole("group", { name: "Tastatur" }).getByRole("button", { name: d, exact: true }).click();
};
const side = (page: Page, name: string) => page.getByRole("list", { name: "Stilling" }).getByRole("listitem").filter({ hasText: name });
const bom = (page: Page) => page.getByRole("button", { name: /^BOM · halverer|^Bom/ });

test.describe("Halv It", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("poeng legges til, en bom halverer og rundes opp, og et tall som ikke kan stemme tas ikke imot", async ({ page }) => {
    await begin(page);
    await expect(page.getByText("RUNDE 1 AV 10")).toBeVisible();
    await expect(page.getByText("20-feltet")).toBeVisible();
    // Round 1: Lars 60, Vadla a bom (half of nothing is nothing).
    await keys(page, "60");
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(side(page, "Lars")).toContainText("60");
    await bom(page).first().click();
    await expect(page.getByText("RUNDE 2 AV 10")).toBeVisible();
    await expect(page.getByText("Dobbel", { exact: true })).toBeVisible();
    // Round 2, doubles: 25 cannot be the sum of doubles, so it cannot be confirmed.
    await keys(page, "25");
    await expect(page.getByRole("button", { name: "Bekreft" })).toBeDisabled();
    await page.getByRole("button", { name: "Slett" }).click();
    await page.getByRole("button", { name: "Slett" }).click();
    await keys(page, "24");
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(side(page, "Lars")).toContainText("84");
    await bom(page).first().click();
    // Round 3 is a yes or a no: two large buttons and no keypad.
    await expect(page.getByText("Eksakt 57")).toBeVisible();
    await expect(page.getByRole("group", { name: "Tastatur" })).toHaveCount(0);
    await page.getByRole("button", { name: /^Klarte det/ }).click();
    await expect(side(page, "Lars")).toContainText("141");
    await bom(page).first().click();
    // Round 4, 60 out: Lars misses, and 141 halved rounded up is 71.
    await expect(page.getByText("60 ut")).toBeVisible();
    await bom(page).first().click();
    await expect(side(page, "Lars")).toContainText("71");
    // Taking the last throw back puts the score back.
    await page.getByRole("button", { name: "Angre siste kast" }).click();
    await expect(side(page, "Lars")).toContainText("141");
  });

  test("lag: ett poengtall for laget, og makkerne kaster hver sin runde", async ({ page }) => {
    await page.addInitScript((list) => {
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify(list.map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }))));
    }, ["Lars og Per", "Ola og Kari"]);
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Andre spill" }).click();
    await page.getByRole("button", { name: "Halv It" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();
    const group = page.getByRole("group", { name: "Lag" });
    for (const n of ["Lars og Per", "Ola og Kari"]) await group.getByRole("button", { name: new RegExp(n) }).click();
    await startMatch(page);
    await expect(side(page, "Lars og Per")).toContainText("Nå: Lars");
    await keys(page, "40");
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(side(page, "Ola og Kari")).toContainText("Nå: Ola");
    await bom(page).first().click();
    // Round 2: the first team again, and it is the other of them.
    await expect(side(page, "Lars og Per")).toContainText("Nå: Per");
  });

  test("lag med begge kastende: laget kaster to ganger per runde, og poengene legges sammen", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify(["Lars og Per", "Ola og Kari"].map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }))));
    });
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Andre spill" }).click();
    await page.getByRole("button", { name: "Halv It" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();
    const group = page.getByRole("group", { name: "Lag" });
    for (const n of ["Lars og Per", "Ola og Kari"]) await group.getByRole("button", { name: new RegExp(n) }).click();
    await page.getByRole("switch", { name: /Avanserte innstillinger/ }).click();
    await page.getByRole("switch", { name: /Begge kaster hver runde/ }).click();
    await startMatch(page);
    await expect(side(page, "Lars og Per")).toContainText("Nå: Lars (1 av 2)");
    await keys(page, "20");
    await page.getByRole("button", { name: "Bekreft" }).click();
    // The second of them throws next, for the same team, and nothing has been added yet.
    await expect(side(page, "Lars og Per")).toContainText("Nå: Per (2 av 2)");
    await keys(page, "40");
    await page.getByRole("button", { name: "Bekreft" }).click();
    await expect(side(page, "Lars og Per")).toContainText("60");
    await expect(side(page, "Ola og Kari")).toContainText("Nå: Ola (1 av 2)");
  });
});
