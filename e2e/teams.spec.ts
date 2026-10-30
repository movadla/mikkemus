import { expect, test } from "@playwright/test";
import { PIN, openApp } from "./helpers";

/** Lag på kamp: the four teams used most, and «Mer» for the rest. */
test.describe("lag på kamp", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("fire lag til å begynne med, og Mer viser resten", async ({ page }) => {
    const names = ["Lars og Per", "Ola og Kari", "Nina og Tor", "Eva og Jon", "Siv og Bjørn", "Anne og Knut"];
    // Six teams this device remembers, the first used last, so the ones shown are known: the four used most recently.
    await page.addInitScript((list) => {
      const cards = list.map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }));
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify(cards));
    }, names);
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Ny kamp" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();

    const group = page.getByRole("group", { name: "Lag" });
    // Four teams and the dashed tile for the rest.
    await expect(group.getByRole("button")).toHaveCount(5);
    await expect(group.getByRole("button", { name: /Lars og Per/ })).toBeVisible();
    await expect(group.getByRole("button", { name: /Anne og Knut/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Flere lag (2)" }).click();
    await expect(group.getByRole("button")).toHaveCount(7);
    await expect(group.getByRole("button", { name: /Anne og Knut/ })).toBeVisible();

    await page.getByRole("button", { name: "Færre lag" }).click();
    await expect(group.getByRole("button")).toHaveCount(5);
  });

  test("et lag som er valgt blir stående, selv om det ikke er blant de fire", async ({ page }) => {
    const names = ["Lars og Per", "Ola og Kari", "Nina og Tor", "Eva og Jon", "Siv og Bjørn"];
    await page.addInitScript((list) => {
      localStorage.setItem("mikke-mus-team-cards", JSON.stringify(list.map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }))));
    }, names);
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Ny kamp" }).click();
    await page.getByRole("radio", { name: "Lag" }).click();
    await page.getByRole("button", { name: "Flere lag (1)" }).click();
    const group = page.getByRole("group", { name: "Lag" });
    await group.getByRole("button", { name: /Siv og Bjørn/ }).click();
    // The team that is in moves up to its own row, and stays there whichever four are shown.
    await page.getByRole("button", { name: "Færre lag" }).click();
    await expect(page.getByRole("group", { name: "Med" }).getByRole("button", { name: /Siv og Bjørn/ })).toBeVisible();
    await expect(group.getByRole("button")).toHaveCount(4);
  });
});
