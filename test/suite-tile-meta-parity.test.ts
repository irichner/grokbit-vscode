/**
 * Source-text parity between `SUITE_TILE_META` and the shipped how-it-works
 * guides it summarizes.
 *
 * The manifest exists so the tile face costs zero I/O to render (see the
 * rationale on `SUITE_TILE_META` itself). The price of that is duplication:
 * the authoritative statement of who runs each phase and how much review it
 * performs lives in `resources/skills/<name>/references/how-it-works.md`, and
 * nothing else in the suite reads those files. Without this test, `npm test`
 * proves only that a TypeScript file agrees with itself, while the tiles
 * quietly describe a pipeline that changed releases ago.
 *
 * Same idiom as `test/hook-parity.test.ts` (the vendored Python hooks vs. their
 * TypeScript mirror) and the `LAUNCHER_PAGE_SIZE` check: read the resource,
 * fail loudly on drift, and let whoever changes one go change the other.
 */
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { SUITE_SKILL_NAMES, SUITE_TILE_META, suiteHowItWorksPath } from "../src/skill-suite";

const REPO_ROOT = path.resolve(__dirname, "..");

function guide(name: string): string {
  const p = suiteHowItWorksPath(REPO_ROOT, name);
  if (!existsSync(p)) throw new Error(`missing how-it-works guide for ${name}: ${p}`);
  return readFileSync(p, "utf8");
}

/** Body of a `## <heading>` section, up to the next `## ` heading or EOF. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  if (start === -1) return "";
  const rest = text.slice(start + heading.length + 3);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** Role names from a `| **Name** | Job |` table row. */
function tableRoles(rolesSection: string): string[] {
  return [...rolesSection.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|/gm)].map((m) => m[1].trim());
}

describe("SUITE_TILE_META parity with the shipped how-it-works guides", () => {
  it("covers every suite skill, and invents no extras", () => {
    expect(Object.keys(SUITE_TILE_META).sort()).toEqual([...SUITE_SKILL_NAMES].sort());
  });

  for (const name of SUITE_SKILL_NAMES) {
    describe(name, () => {
      it("names exactly the roles its guide's Roles table lists", () => {
        const roles = tableRoles(section(guide(name), "Roles"));
        expect(SUITE_TILE_META[name].agents).toEqual(roles);
      });

      it("quotes only review numerals that appear in its guide's Loops and caps", () => {
        const loops = section(guide(name), "Loops and caps");
        expect(loops.trim()).not.toBe("");
        const numerals = SUITE_TILE_META[name].reviews.match(/\d+/g) ?? [];
        // A reviews phrase with no numeral at all would slip through silently.
        expect(numerals.length).toBeGreaterThan(0);
        for (const n of numerals) expect(loops).toContain(n);
      });
    });
  }

  // [R] Ship is the case that breaks any naive "just list the roles" design: it
  // genuinely has no roster, and its guide says so in prose rather than a table.
  // Assertion 1 above already passes vacuously for it (0 names, 0 table rows) —
  // which is exactly why the special case needs its own explicit guard. Give
  // Ship a roster upstream and this fails, instead of the tile silently going
  // from an honest note to a wrong one.
  it("[R] Ship claims no roster of its own, and its guide still says so", () => {
    const ship = SUITE_TILE_META["grokbit-ship"];
    expect(ship.agents).toEqual([]);
    expect((ship.agentsNote ?? "").trim()).not.toBe("");
    expect(section(guide("grokbit-ship"), "Roles")).toContain("Ship has none of its own");
  });

  // Every other phase must NOT take the agentsNote path — it is the fallback for
  // a genuinely empty roster, not a way to hand-write a roster line.
  it("[R] only Ship uses agentsNote", () => {
    for (const name of SUITE_SKILL_NAMES) {
      if (name === "grokbit-ship") continue;
      expect(SUITE_TILE_META[name].agents.length).toBeGreaterThan(0);
      expect(SUITE_TILE_META[name].agentsNote).toBeUndefined();
    }
  });
});
