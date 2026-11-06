import { expect, test } from "@playwright/test";
import { PIN, openApp, startPast } from "./helpers";

/** Lag på kamp: the six teams used most lately, and «Mer» for the rest. */
test.describe("lag på kamp", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("seks lag til å begynne med, og Mer viser resten", async ({ page }) => {
    const names = ["Lars og Per", "Ola og Kari", "Nina og Tor", "Eva og Jon", "Siv og Bjørn", "Anne og Knut", "Maja og Ivar", "Pål og Lise"];
    // Eight teams this device remembers, the first used last, so the ones shown are known: the six used most recently.
    await page.addInitScript((list) => {
      const cards = list.map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }));
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify(cards));
    }, names);
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();

    const group = page.getByRole("group", { name: "Lag" });
    // Six teams and the dashed tile for the rest.
    await expect(group.getByRole("button")).toHaveCount(7);
    await expect(group.getByRole("button", { name: /Lars og Per/ })).toBeVisible();
    await expect(group.getByRole("button", { name: /Anne og Knut/ })).toBeVisible();
    await expect(group.getByRole("button", { name: /Pål og Lise/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Flere lag (2)" }).click();
    await expect(group.getByRole("button")).toHaveCount(9);
    await expect(group.getByRole("button", { name: /Pål og Lise/ })).toBeVisible();

    await page.getByRole("button", { name: "Færre lag" }).click();
    await expect(group.getByRole("button")).toHaveCount(7);
  });

  test("et lag som er valgt blir stående, selv om det ikke er blant de seks", async ({ page }) => {
    const names = ["Lars og Per", "Ola og Kari", "Nina og Tor", "Eva og Jon", "Siv og Bjørn", "Anne og Knut", "Maja og Ivar"];
    await page.addInitScript((list) => {
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify(list.map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }))));
    }, names);
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();
    await page.getByRole("button", { name: "Flere lag (1)" }).click();
    const group = page.getByRole("group", { name: "Lag" });
    await group.getByRole("button", { name: /Maja og Ivar/ }).click();
    // The team that is in moves up to its own row, and stays there whichever six are shown.
    await page.getByRole("button", { name: "Færre lag" }).click();
    await expect(page.getByRole("group", { name: "Med" }).getByRole("button", { name: /Maja og Ivar/ })).toBeVisible();
    await expect(group.getByRole("button")).toHaveCount(6);
  });

  test("lag som er laget står under Spillere, så navn og drakter kan endres", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify([{ name: "Lars og Per", members: ["Lars", "Per"], lastUsed: 1000 }]));
    });
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();
    await expect(page.getByRole("group", { name: "Lag" }).getByRole("button", { name: /Lars og Per/ })).toBeVisible();
    // Without having played: the team is in Spillere, under Lag.
    await page.getByRole("button", { name: "Tilbake" }).first().click();
    await page.getByRole("link", { name: "Spillere" }).first().click();
    await expect(page.getByRole("heading", { name: "Lag" }).or(page.getByText("LAG", { exact: true })).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Lars og Per/ }).first()).toBeVisible();
  });

  test("neste som kaster er på det andre laget, ikke makkeren", async ({ page }) => {
    const names = ["Lars og Per", "Ola og Kari"];
    await page.addInitScript((list) => {
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify(list.map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }))));
    }, names);
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();
    const group = page.getByRole("group", { name: "Lag" });
    await group.getByRole("button", { name: /Lars og Per/ }).click();
    await group.getByRole("button", { name: /Ola og Kari/ }).click();
    await page.getByRole("button", { name: /Start/ }).first().click();
    await startPast(page);
    // Lars throws, and the next to throw is Ola on the other team; the rest of the team is not shown on the bar.
    await expect(page.getByLabel(/^Resten av laget/)).toHaveCount(0);
    await expect(page.getByLabel(/^Neste som kaster: Ola, Ola og Kari/)).toBeVisible();

    // A tap on the picture of the one who throws changes who on the team it is: Per after the question is answered.
    await page.getByRole("button", { name: "Bytt hvem som kaster" }).click();
    await expect(page.getByText("Skal Per kaste nå?")).toBeVisible();
    await page.getByRole("button", { name: "Ja" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText("Per")).toBeVisible();
  });
});
