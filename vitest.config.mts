import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The screenshot tests (e2e/) belong to Playwright and are run with `npm run test:visual`.
    exclude: ["**/node_modules/**", "e2e/**", ".next/**"],
  },
});
