/**
 * Pure mirror of the vendored Grok hook *decision* logic, so CI can prove the
 * gate's behaviour without a real `grok` (or a Python toolchain — `npm test`
 * stays Python-free, like it stays grok-free).
 *
 * `resources/hooks/grok/*.py` is the runtime source of truth; this file is the
 * copy. A mirror nobody checks is worse than no mirror, so the shared
 * constants are declared here as the **same source strings the Python uses**
 * and `test/hook-parity.test.ts` reads the `.py` files and asserts they still
 * match — the `LAUNCHER_PAGE_SIZE` source-text parity idiom. Change a pattern,
 * a label, a retry bound or a user-facing note in one place and that test
 * fails until the other follows.
 *
 * Covers protect_paths allow/block and verify_on_stop decide_stop / PTC parse.
 */

// --- protect_paths ---------------------------------------------------------

/**
 * Verbatim copies of `protect_paths.PROTECTED_PATTERNS`' raw-string sources,
 * in order. Kept as strings, not regex literals: a JS literal has to escape
 * `/` as `\/`, which would make a byte-for-byte comparison against the Python
 * impossible without an unescaping step nobody would trust.
 */
export const PROTECTED_PATTERN_SOURCES: readonly string[] = [
  "(^|/)\\.env($|\\.)",
  "\\.pem$",
  "\\.key$",
  "(^|/)secrets?/",
  "(^|/)\\.git/",
  "(^|/)\\.ssh/",
  "(^|/)id_rsa",
  "(^|/)\\.grok/hooks/",
  "(^|/)\\.grok/settings\\.json$",
  "(^|/)AGENTS\\.md$",
];

const PROTECTED_PATTERNS: RegExp[] = PROTECTED_PATTERN_SOURCES.map((s) => new RegExp(s, "i"));

/** Mirror of protect_paths.normalize_path (POSIX-style collapse). */
export function normalizeHookPath(filePath: string): string {
  const p = filePath.replace(/\\/g, "/");
  // Collapse // and ./ and resolve .. like posixpath.normpath
  const parts = p.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") {
      if (part === "" && out.length === 0) {
        // leading empty from absolute /foo
        if (p.startsWith("/")) out.push("");
      }
      continue;
    }
    if (part === "..") {
      if (out.length && out[out.length - 1] !== "..") {
        if (out[out.length - 1] === "") {
          /* stay at root */
        } else {
          out.pop();
        }
      } else if (!p.startsWith("/")) {
        out.push("..");
      }
      continue;
    }
    out.push(part);
  }
  let result = out.join("/");
  if (result === "" && p.startsWith("/")) result = "/";
  if (result === "") result = ".";
  // posixpath.normpath(".grok/./hooks/x") → ".grok/hooks/x"
  return result;
}

export function matchedProtectedPattern(filePath: string): string | null {
  const normalized = normalizeHookPath(filePath);
  for (const pattern of PROTECTED_PATTERNS) {
    if (pattern.test(normalized)) return pattern.source;
  }
  return null;
}

/** Mirror of `protect_paths.decide`'s deny reason — asserted against the .py. */
export function protectPathsReason(filePath: string, pattern: string): string {
  return (
    `Blocked by protect_paths.py: '${filePath}' matches protected pattern /${pattern}/. ` +
    "Secrets, VCS internals, and the enforcement layer itself must be edited by a " +
    "human, not the agent."
  );
}

export function decideProtectPaths(payload: {
  toolInput?: { file_path?: unknown } | null;
}): { code: number; deny: boolean; reason?: string } {
  const toolInput = payload.toolInput;
  const filePath =
    toolInput && typeof toolInput === "object" ? toolInput.file_path : undefined;
  if (typeof filePath !== "string" || !filePath) {
    return { code: 0, deny: false };
  }
  const pattern = matchedProtectedPattern(filePath);
  if (!pattern) return { code: 0, deny: false };
  return { code: 2, deny: true, reason: protectPathsReason(filePath, pattern) };
}

// --- verify_on_stop PTC + decide_stop --------------------------------------

export const BEGIN_PTC = "<!-- BEGIN PROJECT_TEST_COMMANDS -->";
export const END_PTC = "<!-- END PROJECT_TEST_COMMANDS -->";
export const GATE_LABELS: readonly string[] = ["Lint", "Unit tests"];
export const DEFAULT_MAX_BLOCKS = 3;

export const ROW_PATTERN_SOURCE = "^-\\s*\\*\\*([^:*]+):\\*\\*\\s*(.+)$";
export const CMD_PATTERN_SOURCE = "`([^`]+)`";
export const PLACEHOLDER_PATTERN_SOURCE = "^(TODO|NONE)\\b";

const ROW_RE = new RegExp(ROW_PATTERN_SOURCE, "gm");
const CMD_RE = new RegExp(CMD_PATTERN_SOURCE, "g");
const PLACEHOLDER_RE = new RegExp(PLACEHOLDER_PATTERN_SOURCE, "i");

export function extractPtcRows(agentsText: string): Record<string, string> {
  // `str.split(sep, limit)` in JS *truncates the array*, where Python's
  // `str.split(sep, maxsplit)` keeps the remainder — so a naive port silently
  // disagrees with the Python whenever a marker appears twice. Slice by index
  // instead, which is what `split(sep, 1)` actually means.
  const begin = agentsText.indexOf(BEGIN_PTC);
  if (begin < 0) return {};
  const afterBegin = agentsText.slice(begin + BEGIN_PTC.length);
  const end = afterBegin.indexOf(END_PTC);
  if (end < 0) return {};
  const block = afterBegin.slice(0, end);
  const rows: Record<string, string> = {};
  ROW_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROW_RE.exec(block)) !== null) {
    rows[m[1].trim()] = m[2].trim();
  }
  return rows;
}

export function isPlaceholderCommand(cmd: string): boolean {
  return !cmd || PLACEHOLDER_RE.test(cmd);
}

export function extractGateCommands(
  rows: Record<string, string>,
  labels: readonly string[] = GATE_LABELS,
): Array<{ label: string; command: string }> {
  const commands: Array<{ label: string; command: string }> = [];
  for (const label of labels) {
    const value = rows[label] ?? "";
    CMD_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CMD_RE.exec(value)) !== null) {
      const cmd = m[1].trim();
      if (isPlaceholderCommand(cmd)) continue;
      commands.push({ label, command: cmd });
    }
  }
  return commands;
}

export type StopAction = "allow" | "block" | "release";

export interface CommandResultLike {
  label: string;
  command: string;
  passed: boolean;
  output: string;
}

export interface StopDecision {
  action: StopAction;
  exitCode: number;
  clearChanged: boolean;
  counterAction: "leave" | "clear" | "increment";
  newCount: number;
  stderrNote?: string;
}

/** Verbatim mirror of `verify_on_stop.NO_COMMANDS_NOTE`. */
export const NO_COMMANDS_NOTE =
  "verify_on_stop.py: files changed this session but zero Lint/Unit tests " +
  "commands were found to run (TODO/NONE rows in AGENTS.md, or the " +
  "PROJECT_TEST_COMMANDS markers are missing) -- nothing was verified this " +
  "turn. This is allowed to proceed (a fresh, unfilled install is a " +
  "legitimate state) but is never silent, so a neutered gate always leaves " +
  "a trace.";

export function decideStop(opts: {
  changed: boolean;
  results: CommandResultLike[] | null;
  currentCount: number;
  maxBlocks?: number;
}): StopDecision {
  const maxBlocks = opts.maxBlocks ?? DEFAULT_MAX_BLOCKS;
  if (!opts.changed) {
    return {
      action: "allow",
      exitCode: 0,
      clearChanged: false,
      counterAction: "leave",
      newCount: 0,
    };
  }
  if (!opts.results || opts.results.length === 0) {
    return {
      action: "allow",
      exitCode: 0,
      clearChanged: true,
      counterAction: "clear",
      newCount: 0,
      stderrNote: NO_COMMANDS_NOTE,
    };
  }
  if (opts.results.every((r) => r.passed)) {
    return {
      action: "allow",
      exitCode: 0,
      clearChanged: true,
      counterAction: "clear",
      newCount: 0,
    };
  }
  const count = opts.currentCount + 1;
  if (count >= maxBlocks) {
    return {
      action: "release",
      exitCode: 0,
      clearChanged: false,
      counterAction: "clear",
      newCount: 0,
    };
  }
  return {
    action: "block",
    exitCode: 2,
    clearChanged: false,
    counterAction: "increment",
    newCount: count,
  };
}
