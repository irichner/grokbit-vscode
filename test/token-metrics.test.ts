import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEV_TOKENS_GENERATED_AT,
  DEV_TOKENS_SESSIONS,
  DEV_TOKENS_TOTAL,
} from "../src/token-metrics";

/**
 * `src/token-metrics.ts` is GENERATED (scripts/aggregate_token_usage.py, via
 * `npm run metrics:tokens`) and committed. The extension displays it verbatim in
 * the launcher header, so a bad generator run must not be able to ship silently
 * — these are the shape guards that catch one.
 */
describe("token-metrics (generated development-cost constant)", () => {
  it("exports a finite, non-negative integer total", () => {
    expect(typeof DEV_TOKENS_TOTAL).toBe("number");
    expect(Number.isFinite(DEV_TOKENS_TOTAL)).toBe(true);
    expect(Number.isInteger(DEV_TOKENS_TOTAL)).toBe(true);
    expect(DEV_TOKENS_TOTAL).toBeGreaterThanOrEqual(0);
  });

  it("exports a non-negative integer session count", () => {
    expect(Number.isInteger(DEV_TOKENS_SESSIONS)).toBe(true);
    expect(DEV_TOKENS_SESSIONS).toBeGreaterThanOrEqual(0);
  });

  it("exports a parseable ISO generation stamp", () => {
    expect(typeof DEV_TOKENS_GENERATED_AT).toBe("string");
    expect(DEV_TOKENS_GENERATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Number.isNaN(new Date(DEV_TOKENS_GENERATED_AT).getTime())).toBe(false);
  });

  it("counts at least one session whenever it reports tokens", () => {
    if (DEV_TOKENS_TOTAL > 0) expect(DEV_TOKENS_SESSIONS).toBeGreaterThan(0);
  });

  it("stays a data module — no imports, no logic", () => {
    // A compiled-in constant has no runtime failure mode; anything executable
    // in here would reintroduce one (and, worse, invite a runtime recompute —
    // the exact per-user meter this ledger replaced).
    const source = readFileSync(
      path.join(__dirname, "..", "src", "token-metrics.ts"),
      "utf8",
    );
    const body = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
    expect(body).toHaveLength(3);
    for (const line of body) expect(line).toMatch(/^export const DEV_TOKENS_[A-Z_]+ = .+;$/);
    expect(source).toMatch(/do not hand-edit/i);
    expect(source).toContain("aggregate_token_usage.py");
  });
});
