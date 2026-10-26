import { defineConfig } from "@playwright/test";

/**
 * Screenshot tests of the main screens (see e2e/visual.spec.ts): each screen is photographed at two phone widths and compared with
 * the picture taken last time, so a change that moves things it should not have touched shows up as a difference.
 *
 * They run in the browser that is already on the machine (Edge on Windows, Chrome elsewhere), so nothing is downloaded, against
 * the dev server on port 3011 (started if it is not already running). The pictures are of this machine's fonts: update them with
 * `npm run test:visual:update` after a change that is meant to look different.
 */
export default defineConfig({
  testDir: "e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  use: {
    baseURL: "http://localhost:3011",
    channel: process.platform === "win32" ? "msedge" : "chrome",
    colorScheme: "dark",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "phone-360", use: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 } },
    { name: "phone-430", use: { viewport: { width: 430, height: 900 }, deviceScaleFactor: 1 } },
  ],
  webServer: { command: "npm run dev", url: "http://localhost:3011", reuseExistingServer: true, timeout: 120_000 },
});
