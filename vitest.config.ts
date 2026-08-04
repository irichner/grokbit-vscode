import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["test/**", "out/**"],
      // No thresholds / fail_under — measure-first (plan T1); baseline in T2.
      reporter: ["text", "text-summary"],
    },
  },
});
