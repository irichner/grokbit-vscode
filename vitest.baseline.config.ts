import { defineConfig } from "vitest/config";

// Separate from the default suite, for the same reason vitest.perf.config.ts is:
// these are baseline characterization tests captured before a planned change
// (`.grokbit/plans/<slug>/test/baseline.md`), and some of them are EXPECTED to go
// red once that change lands — that is the instrument working, not a defect. Left
// in `npm test` they would block every implement task's own verify command. The
// default config only matches `*.test.ts`, so `*.baseline.ts` never runs there;
// this config matches them explicitly (`npm run test:baseline`).
export default defineConfig({
  test: {
    include: ["test/**/*.baseline.ts"],
    environment: "node",
  },
});
