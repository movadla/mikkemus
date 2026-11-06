import { expect, test } from "@playwright/test";
import { PIN, openApp, startMatch, startPast } from "./helpers";

/** On a computer the board is played from the keyboard: Space marks the row the thrower is on, Enter is Bekreft, Backspace is Angre. */
test.describe("tastatur på brettet", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("mellomrom setter kryss, Enter bekrefter og Backspace angrer", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("button", { name: /Start/ }).first().click();
    await startPast(page);
    const thrower = page.getByRole("status").filter({ hasText: "Kaster" });
    await expect(thrower.getByText("Lars")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bekreft (bom)" })).toBeVisible();

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Bekreft", exact: true })).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(page.getByRole("button", { name: "Bekreft (bom)" })).toBeVisible();

    // D and T mark the rows D and T further down.
    await page.keyboard.press("t");
    await expect(page.getByRole("button", { name: "Bekreft", exact: true })).toBeVisible();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("d");
    await expect(page.getByRole("button", { name: "Bekreft", exact: true })).toBeVisible();
    await page.keyboard.press("Backspace");

    // Three Spaces in a row are three crosses on the number, the third one too.
    for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
    await expect(page.getByText("3 piler på rad")).toBeVisible();
    for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");

    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    await expect(thrower.getByText("Vadla")).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(thrower.getByText("Lars")).toBeVisible();
  });
});

/** The place lies behind the board in a tournament match too, with four in a heat as with two. */
test.describe("stedet bak brettet i turnering", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("en heat med fire har stedets bilde bak brettet", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Turnering" }).first().click();
    for (const name of ["Lars", "Vadla", "Moen", "Hans"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("radio", { name: "Mot boter" }).click();
    await page.getByRole("radio", { name: /Ly Pilotturnering/ }).click();
    await page.getByRole("button", { name: "Neste" }).click();
    await expect(page.getByText(/NESTE · HEAT [A-D]/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^(Spill|Start)/ }).last().click();
    await startPast(page);
    await expect(page.locator(".game-root.venue-bg")).toBeVisible();
  });
});

/** «Tre tellende piler?» answers to J and N. */
test.describe("tre tellende piler på tastatur", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  for (const [key, who] of [["j", "Lars"], ["n", "Ola"]] as const) {
    test(`${key} svarer på spørsmålet`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("mikke-mus-team-cards", JSON.stringify(["Lars og Per", "Ola og Kari"].map((name, i) => ({ name, members: name.split(" og "), lastUsed: 1000 - i }))));
      });
      await openApp(page, "dark");
      await page.getByRole("button", { name: "Nytt spill" }).click();
      await page.getByRole("button", { name: "Mikke Mus" }).click();
      await page.getByRole("radio", { name: "Lag" }).click();
      const group = page.getByRole("group", { name: "Lag" });
      await group.getByRole("button", { name: /Lars og Per/ }).click();
      await group.getByRole("button", { name: /Ola og Kari/ }).click();
      await page.getByRole("button", { name: /Start/ }).first().click();
      await startPast(page);
      await page.getByRole("button", { name: "Meny" }).click();
      await page.getByRole("button", { name: "Skru på stå ved 3 tellende piler" }).click();
      await page.keyboard.press("Escape");
      for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("group", { name: "Tre tellende piler?" })).toBeVisible();
      await page.keyboard.press(key);
      await expect(page.getByRole("group", { name: "Tre tellende piler?" })).toBeHidden();
      await expect(page.getByRole("status").filter({ hasText: "Kaster" }).getByText(who, { exact: true })).toBeVisible();
    });
  }
});

/** After Angre a bot does not throw by itself: the player says it may. */
test.describe("bot etter angre", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("Angre går ikke rett til botens kast, men spør først", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mikke-mus-bot-speed", "instant"));
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Mikke Mus" }).click();
    await page.getByRole("button", { name: "Ny spiller" }).click();
    await page.getByPlaceholder("Spillernavn").fill("Lars");
    await page.getByRole("button", { name: "Legg til" }).click();
    await page.getByRole("button", { name: "Bot", exact: true }).click();
    await page.locator("div.grid-cols-3 button").first().click();
    await page.getByRole("button", { name: /Start/ }).first().click();
    await startPast(page);
    const thrower = page.getByRole("status").filter({ hasText: "Kaster" });
    await expect(thrower.getByText("Lars", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    // The bot throws its round by itself, and it is Lars's turn again.
    await expect(thrower.getByText("Kaster …")).toBeVisible();
    await expect(thrower.getByText("Lars", { exact: true })).toBeVisible({ timeout: 20_000 });
    // Angre takes the turns back one by one; the bot is never let loose by it: when it is the bot's turn again, the question comes first.
    for (let n = 0; n < 12; n++) await page.keyboard.press("Backspace");
    // Lars's own turn is open again to be corrected; confirming it hands over to the bot.
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    const ask = page.getByRole("dialog").getByText("kaste nå?");
    await expect(ask).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(ask).toBeVisible();
    await page.getByRole("button", { name: "Ja, kast" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

/** The numbers of Highstriker (and 301/501) are written from the keyboard on a computer. */
test.describe("tall fra tastaturet", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("Highstriker: sifre, Backspace og Enter", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Nytt spill" }).click();
    await page.getByRole("button", { name: "Highstriker" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await startMatch(page);
    await page.keyboard.press("1");
    await expect(page.getByLabel("Skrevet: 1")).toBeVisible();
    await page.keyboard.press("8");
    await expect(page.getByLabel("Skrevet: 18")).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(page.getByLabel("Skrevet: 1")).toBeVisible();
    await page.keyboard.press("5");
    await expect(page.getByLabel("Skrevet: 15")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Ingen tall skrevet")).toBeVisible();
  });
});
