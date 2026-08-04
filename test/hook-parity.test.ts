/**
 * Source-text parity between the vendored Python hooks and their TypeScript
 * mirror in `src/grok-hooks-policy.ts`.
 *
 * Without this, `npm test` proves only that a TypeScript file agrees with
 * itself: the Python under `resources/hooks/grok/` is what actually runs in a
 * user's session, and nothing else in the suite reads it (CI is Python-free by
 * design, like it is grok-free). Same idiom as the `LAUNCHER_PAGE_SIZE`
 * parity check between `launcher.js` and `sidebar.ts` — compare the source
 * text, fail loudly on drift, and let whoever changes one go change the other.
 *
 * These assertions caught real day-one drift: `NO_COMMANDS_NOTE` and the
 * protect_paths deny reason had both been paraphrased in the mirror.
 */
import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BEGIN_PTC,
  CMD_PATTERN_SOURCE,
  DEFAULT_MAX_BLOCKS,
  END_PTC,
  GATE_LABELS,
  NO_COMMANDS_NOTE,
  PLACEHOLDER_PATTERN_SOURCE,
  PROTECTED_PATTERN_SOURCES,
  ROW_PATTERN_SOURCE,
  protectPathsReason,
} from "../src/grok-hooks-policy";
import { HOOK_BUNDLE_FILES } from "../src/hook-suite";

const BUNDLE = path.join(__dirname, "..", "resources", "hooks", "grok");
const read = (name: string) => readFileSync(path.join(BUNDLE, name), "utf8");

const PROTECT_PY = read("protect_paths.py");
const STOP_PY = read("verify_on_stop.py");

/**
 * Join a Python implicit-concatenation string literal group, e.g.
 *   NAME = (
 *       "one "
 *       "two"
 *   )
 * into `"one two"`, so a multi-line note can be compared as one value.
 */
function pyJoinedString(source: string, name: string): string {
  const start = source.indexOf(`${name} = (`);
  expect(start, `${name} not found in Python source`).toBeGreaterThan(-1);
  const rest = source.slice(start);
  // The group ends at the first line whose only content is `)` — matching on a
  // bare "\n)" instead would run past an indented close and swallow the rest
  // of the module.
  const close = rest.search(/\n[ \t]*\)/);
  expect(close, `${name} has no closing paren`).toBeGreaterThan(-1);
  const body = rest.slice(0, close);
  return [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("");
}

describe("hook parity — vendored Python vs the TypeScript mirror", () => {
  it("[R] protect_paths patterns match, in order", () => {
    const pyPatterns = [...PROTECT_PY.matchAll(/re\.compile\(\s*r"([^"]*)",\s*re\.IGNORECASE\s*\)/g)].map(
      (m) => m[1],
    );
    expect(pyPatterns.length).toBeGreaterThan(0);
    expect([...PROTECTED_PATTERN_SOURCES]).toEqual(pyPatterns);
  });

  it("[R] the deny reason is word-for-word the Python's", () => {
    const pyReason = pyJoinedString(PROTECT_PY, "    reason")
      .replace("{file_path}", "SOME/PATH")
      .replace("{pattern}", "PATTERN");
    expect(protectPathsReason("SOME/PATH", "PATTERN")).toBe(pyReason);
  });

  it("[R] the no-commands note is word-for-word the Python's", () => {
    expect(NO_COMMANDS_NOTE).toBe(pyJoinedString(STOP_PY, "NO_COMMANDS_NOTE"));
  });

  it("[R] PTC markers, gate labels and retry bound match", () => {
    expect(STOP_PY).toContain(`BEGIN_PTC = "${BEGIN_PTC}"`);
    expect(STOP_PY).toContain(`END_PTC = "${END_PTC}"`);
    const labels = STOP_PY.match(/GATE_LABELS:[^=]*=\s*\(([^)]*)\)/);
    expect(labels).toBeTruthy();
    const pyLabels = [...labels![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect([...GATE_LABELS]).toEqual(pyLabels);
    expect(STOP_PY).toContain(`DEFAULT_MAX_BLOCKS = ${DEFAULT_MAX_BLOCKS}`);
  });

  it("[R] the PTC row / command / placeholder patterns match", () => {
    expect(STOP_PY).toContain(`_ROW_RE = re.compile(r"${ROW_PATTERN_SOURCE}", re.MULTILINE)`);
    expect(STOP_PY).toContain(`_CMD_RE = re.compile(r"${CMD_PATTERN_SOURCE}")`);
    expect(STOP_PY).toContain(
      `_PLACEHOLDER_RE = re.compile(r"${PLACEHOLDER_PATTERN_SOURCE}", re.IGNORECASE)`,
    );
  });
});

describe("hook bundle manifest", () => {
  // HOOK_BUNDLE_FILES is an exact manifest — `installHooks` refuses to install
  // when a listed file is absent, so a name that drifts out of step with the
  // directory bricks the whole feature rather than degrading.
  it("[R] lists exactly what ships under resources/hooks/grok/", () => {
    const onDisk = readdirSync(BUNDLE)
      .filter((n) => n !== "__pycache__")
      .sort();
    expect(onDisk).toEqual([...HOOK_BUNDLE_FILES].sort());
  });

  it("[R] every wired command names a script that is actually bundled", () => {
    const wired = JSON.parse(read("settings.json"));
    const scripts: string[] = [];
    for (const matchers of Object.values(wired.hooks) as { hooks: { command: string }[] }[][]) {
      for (const entry of matchers) {
        for (const hook of entry.hooks) {
          const m = hook.command.match(/([\w-]+\.py)/);
          if (m) scripts.push(m[1]);
        }
      }
    }
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(HOOK_BUNDLE_FILES).toContain(script);
  });

  // The SessionEnd hook writes docs/metrics/pending-commit.env, which only a
  // repo running scripts/prepare_commit_metrics.py consumes. Installing hooks
  // must never create that directory in a stranger's project.
  it("[R] record_session_tokens refuses a repo with no ledger consumer", () => {
    const py = read("record_session_tokens.py");
    expect(py).toContain('CONSUMER_REL = Path("scripts") / "prepare_commit_metrics.py"');
    expect(py).toMatch(/if not has_ledger_consumer\(root\):\s*\n\s*return None/);
    // The guard must precede the first directory-creating write.
    expect(py.indexOf("has_ledger_consumer(root)")).toBeLessThan(py.indexOf("mkdir(parents=True"));
  });
});
