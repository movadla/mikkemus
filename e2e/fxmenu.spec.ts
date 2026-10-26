import { expect, test } from "@playwright/test";
import { PIN, openApp, startPast } from "./helpers";

/** The animation level changed in the middle of a match: the choice lies on top of the match menu, and Enkel can be left again. */
test.describe("modus i kampen", () => {
  test.skip(!PIN, "E2E_PIN is not set");

  test("valget ligger over Kamp-menyen, og man kommer tilbake fra Enkel", async ({ page }) => {
    await openApp(page, "dark");
    await page.getByRole("button", { name: "Ny kamp" }).click();
    for (const name of ["Lars", "Vadla"]) {
      await page.getByRole("button", { name: "Ny spiller" }).click();
      await page.getByPlaceholder("Spillernavn").fill(name);
      await page.getByRole("button", { name: "Legg til" }).click();
    }
    await page.getByRole("button", { name: /Start/ }).first().click();
    await startPast(page);

    // From the match menu: the level sheet opens, and what is tapped in it is the level sheet, not the menu behind it.
    await page.getByRole("button", { name: "Meny", exact: true }).click();
    await page.getByRole("button", { name: /^Effekter:/ }).click();
    const fx = page.getByRole("dialog", { name: "Animasjon og lyd" });
    await expect(fx).toBeVisible();
    const simple = fx.getByRole("radio", { name: "Enkel" });
    await simple.click(); // would be intercepted by the menu if that lay on top
    await fx.getByRole("button", { name: "Bytt til Enkel" }).click();

    // Enkel is the chalkboard, and it has a way back.
    await expect(page.getByText("ENKEL: TELLER IKKE I STATISTIKKEN")).toBeVisible();
    await page.getByRole("button", { name: "Bytt modus" }).click();
    await page.getByRole("dialog", { name: "Animasjon og lyd" }).getByRole("radio", { name: "Vanlig" }).click();
    await expect(page.getByText("ENKEL: TELLER IKKE I STATISTIKKEN")).toBeHidden();
  });
});
