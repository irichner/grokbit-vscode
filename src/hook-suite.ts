/**
 * Bundled Grok workspace harness hooks — what ships in the vsix, where they
 * are provisioned, and the policy for install / overwrite / dual-stack warn.
 *
 * No `vscode` and no top-level `node:fs`: the pure policy is plain functions,
 * and the one impure routine (`installHooks`) takes its filesystem through the
 * injected `HookFsLike` port, mirroring `sessions.ts`'s `FsLike` and
 * `capabilities.ts`'s `CapabilityFsLike`. `extension.ts` supplies
 * `node:fs/promises` and the `vscode` chrome around it.
 *
 * Unlike skills (home-tier, every project), hooks are **workspace-first**:
 * they land in `<workspace>/.grok/hooks/` so each repo opts in. Default
 * setting is `off`; install is command-driven (or `workspace` mode on
 * activation). Users must still run `/hooks-trust` for project hooks to fire,
 * and the wired commands need a Python interpreter on PATH.
 */
import * as path from "node:path";

/** Directory inside the extension (relative to its root) holding Grok hooks. */
export const HOOK_BUNDLE_DIR = path.join("resources", "hooks", "grok");

/**
 * Written beside provisioned hooks, holding the extension version that wrote
 * them. Dot-prefixed so it is not mistaken for a hook wiring JSON
 * (discovery is `*.json` under `.grok/hooks/`).
 */
export const HOOK_MARKER_FILE = ".grokbit-hooks-version";

/** The wiring file among the bundle — retargeted to the host's interpreter. */
export const HOOK_SETTINGS_FILE = "settings.json";

/**
 * Files copied from the bundle into the workspace hooks dir. This is an
 * exact manifest, not a wish list: `installHooks` refuses to install (and
 * refuses to write the version marker) when the bundle is missing any of
 * them, because a partial copy is a gate that reports itself installed and
 * then dies at `import _common` on every event. `test/hook-parity.test.ts`
 * holds this list to the real contents of `resources/hooks/grok/`.
 */
export const HOOK_BUNDLE_FILES: readonly string[] = [
  "_common.py",
  "mark_changed.py",
  "protect_paths.py",
  "record_session_tokens.py",
  "session_start.py",
  "verify_on_stop.py",
  "settings.json",
  "README.md",
];

/** Absolute path to the workspace Grok hooks directory. */
export function workspaceHooksDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".grok", "hooks");
}

/** Absolute path to workspace Claude hooks directory (settings-adjacent). */
export function workspaceClaudeHooksDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".claude", "hooks");
}

/** Absolute path to Claude project settings that may declare hooks. */
export function workspaceClaudeSettingsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".claude", "settings.json");
}

/**
 * Whether the provisioned copy needs rewriting (version inequality).
 * Same contract as skill-suite `shouldProvision`: downgrade re-copies too.
 */
export function shouldProvisionHooks(
  installedVersion: string | undefined,
  bundledVersion: string,
): boolean {
  const installed = (installedVersion ?? "").trim();
  if (!installed) return true;
  return installed !== bundledVersion.trim();
}

export type HooksProvisionMode = "off" | "workspace";

/**
 * Pure decision for whether/how to install hooks into a workspace.
 *
 * - `mode: "off"` + not force → skip (activation path).
 * - Existing foreign/managed content without force → refuse (caller prompts).
 * - force → backup-and-copy when dest has content; else copy.
 * - empty / missing dest → copy when mode allows or force.
 */
export function decideHooksProvision(opts: {
  /** Known modes: off | workspace. Unknown strings must skip (never force-install). */
  mode: HooksProvisionMode | string;
  /** Explicit install command / --force. */
  force: boolean;
  /**
   * True when the destination holds ANY entry other than our own version
   * marker — not just entries that look like hooks. Grok discovers wiring
   * from `*.json` under `.grok/hooks/`, and a repo may keep its own `.sh`,
   * `.ps1` or `.js` hook scripts there, so a "does it look like hooks to us"
   * test would let the auto path write into a directory it did not recognise
   * without backing it up first. See `hasNonMarkerContent`.
   */
  destHasContent: boolean;
  installedVersion: string | undefined;
  bundledVersion: string;
}): {
  action: "skip" | "copy" | "refuse" | "backup-and-copy";
  reason: string;
} {
  const version = (opts.bundledVersion ?? "").trim();
  if (!version) {
    return { action: "skip", reason: "no-bundled-version" };
  }

  if (!opts.force && opts.mode === "off") {
    return { action: "skip", reason: "provision-off" };
  }

  if (!opts.force && opts.mode === "workspace") {
    if (!shouldProvisionHooks(opts.installedVersion, version)) {
      return { action: "skip", reason: "version-current" };
    }
    // Auto mode never clobbers an existing hooks tree that is not ours
    // (or is ours but we still need a rewrite — backup when content exists).
    if (opts.destHasContent) {
      const ours = Boolean((opts.installedVersion ?? "").trim());
      if (!ours) {
        return {
          action: "refuse",
          reason: "existing-hooks-require-force",
        };
      }
      return { action: "backup-and-copy", reason: "version-rewrite" };
    }
    return { action: "copy", reason: "fresh-install" };
  }

  // Non-force + unknown/typo mode must never install (do not fall through to force).
  if (!opts.force) {
    return { action: "skip", reason: "provision-off-or-unknown-mode" };
  }

  // force path (command) only
  if (opts.destHasContent) {
    return { action: "backup-and-copy", reason: "force-overwrite" };
  }
  return { action: "copy", reason: "force-fresh" };
}

/**
 * Timestamped backup directory name under `.grok/`. Pure string builder.
 * Millisecond precision on purpose — two forced installs inside one second
 * would otherwise resolve to the same directory and the second backup would
 * merge into (and partly overwrite) the first.
 */
export function hooksBackupDirName(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}` +
    `${String(d.getUTCMilliseconds()).padStart(3, "0")}Z`;
  return `hooks-backup-${stamp}`;
}

export function workspaceHooksBackupDir(workspaceRoot: string, nowMs?: number): string {
  return path.join(workspaceRoot, ".grok", hooksBackupDirName(nowMs));
}

/**
 * Dual-stack detection: both Grok and Claude project hook layers present.
 * Extension does not rename Claude agents; it only warns (ADR 0002 lineage).
 */
export function detectDualHookStacks(opts: {
  hasGrokHooks: boolean;
  hasClaudeHooks: boolean;
}): { dual: boolean; message: string | null } {
  if (opts.hasGrokHooks && opts.hasClaudeHooks) {
    return {
      dual: true,
      message:
        "Both .grok/hooks and Claude hooks (.claude/hooks or hooks in .claude/settings.json) " +
        "are present. Grok may load both stacks under folder trust — expect double Stop gates " +
        "and path guards. Prefer one stack per session type; see CLAUDE.md Known limits.",
    };
  }
  return { dual: false, message: null };
}

/**
 * True when a directory listing suggests *installed hooks* (any `.py` or
 * `settings.json`). This is the **dual-stack** question ("is there a live hook
 * layer here?"), deliberately narrower than `hasNonMarkerContent` — which is
 * the **overwrite-safety** question ("is there anything here at all?").
 * Pure relative to the injected name list (no I/O).
 */
export function dirLooksLikeHooks(entryNames: readonly string[]): boolean {
  const lower = entryNames.map((n) => n.toLowerCase());
  return lower.some((n) => n === "settings.json" || n.endsWith(".py"));
}

/**
 * True when the destination holds anything other than our own version marker.
 * This — not `dirLooksLikeHooks` — is what gates backup/refuse, so a directory
 * holding only hook wiring we don't recognise still counts as content.
 */
export function hasNonMarkerContent(entryNames: readonly string[]): boolean {
  return entryNames.some((n) => n !== HOOK_MARKER_FILE);
}

/**
 * Bundle files missing from `available`. A non-empty result means the vsix is
 * damaged: install must abort *before* touching the workspace, since the
 * destructive backup+remove step runs ahead of the copy.
 */
export function missingHookFiles(
  available: readonly string[],
  wanted: readonly string[] = HOOK_BUNDLE_FILES,
): string[] {
  const set = new Set(available.map((n) => n.toLowerCase()));
  return wanted.filter((name) => !set.has(name.toLowerCase()));
}

// --- Interpreter -----------------------------------------------------------

/** Interpreter the bundled `settings.json` is written against. */
export const HOOK_DEFAULT_INTERPRETER = "python";

/** Probed in order; the first one that answers `--version` wins. */
export const HOOK_INTERPRETER_CANDIDATES: readonly string[] = ["python", "python3"];

/**
 * Pick the interpreter to wire into the copied `settings.json`.
 *
 * Every hook is `python "<path>.py"`, and on most macOS/Linux installs `python`
 * simply does not exist (only `python3`) — wiring the default there produces a
 * gate that reports itself installed and never fires. `null` means nothing was
 * found: install still proceeds (the user may add Python later) but the caller
 * must say so out loud rather than claim success.
 */
export function pickHookInterpreter(available: readonly string[]): string | null {
  for (const candidate of HOOK_INTERPRETER_CANDIDATES) {
    if (available.includes(candidate)) return candidate;
  }
  return null;
}

/**
 * Rewrite the `python …` prefix of every wired hook command to *interpreter*.
 * Pure text→text; returns the input unchanged when it isn't parseable JSON or
 * when the interpreter is already the bundled default.
 */
export function retargetHookSettings(settingsText: string, interpreter: string): string {
  const target = (interpreter || "").trim();
  if (!target || target === HOOK_DEFAULT_INTERPRETER) return settingsText;
  let parsed: unknown;
  try {
    parsed = JSON.parse(settingsText);
  } catch {
    return settingsText;
  }
  if (!parsed || typeof parsed !== "object") return settingsText;
  const hooks = (parsed as { hooks?: unknown }).hooks;
  if (!hooks || typeof hooks !== "object") return settingsText;
  for (const matchers of Object.values(hooks as Record<string, unknown>)) {
    if (!Array.isArray(matchers)) continue;
    for (const entry of matchers) {
      const inner = (entry as { hooks?: unknown })?.hooks;
      if (!Array.isArray(inner)) continue;
      for (const hook of inner) {
        const command = (hook as { command?: unknown })?.command;
        if (typeof command !== "string") continue;
        if (!command.startsWith(`${HOOK_DEFAULT_INTERPRETER} `)) continue;
        (hook as { command: string }).command =
          `${target} ${command.slice(HOOK_DEFAULT_INTERPRETER.length + 1)}`;
      }
    }
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

// --- Install ---------------------------------------------------------------

/** Filesystem port for `installHooks` (a subset of `node:fs/promises`). */
export interface HookFsLike {
  readdir(dir: string): Promise<string[]>;
  readFile(file: string, encoding: "utf8"): Promise<string>;
  writeFile(file: string, data: string, encoding: "utf8"): Promise<void>;
  mkdir(dir: string, options: { recursive: true }): Promise<string | undefined>;
  rm(dir: string, options: { recursive: true; force: true }): Promise<void>;
  cp(from: string, to: string, options: { recursive: true; force: true }): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
}

export interface InstallHooksResult {
  status: "ok" | "failed";
  reason: string;
  /** Bundle files actually written into the destination. */
  copied: string[];
  /** Absolute path of the backup taken, when one was. */
  backedUpTo?: string;
}

/**
 * Copy the bundle into *dest*, optionally backing up what is already there,
 * and stamp the version marker — but only on a provably complete copy.
 *
 * Order matters and is the whole point of this function: the bundle is
 * validated **before** the backup-and-remove step, so a damaged vsix can never
 * delete a user's hooks and leave nothing in their place; and the marker is
 * written **last**, only after every manifest file landed, so a partial or
 * empty copy is never recorded as "version current" and skipped forever.
 */
export async function installHooks(opts: {
  fs: HookFsLike;
  source: string;
  dest: string;
  version: string;
  /** Provide to back up the existing destination before overwriting it. */
  backupDir?: string;
  /** Interpreter for the wired commands; defaults to the bundled `python`. */
  interpreter?: string | null;
  files?: readonly string[];
  log?: (line: string) => void;
}): Promise<InstallHooksResult> {
  const files = opts.files ?? HOOK_BUNDLE_FILES;
  const log = opts.log ?? (() => {});
  const version = (opts.version ?? "").trim();
  if (!version) return { status: "failed", reason: "no-bundled-version", copied: [] };

  let available: string[];
  try {
    available = await opts.fs.readdir(opts.source);
  } catch (e) {
    return { status: "failed", reason: `bundle-unreadable: ${errText(e)}`, copied: [] };
  }
  const missing = missingHookFiles(available, files);
  if (missing.length > 0) {
    return {
      status: "failed",
      reason: `bundle-incomplete: missing ${missing.join(", ")}`,
      copied: [],
    };
  }

  let backedUpTo: string | undefined;
  try {
    if (opts.backupDir) {
      await opts.fs.mkdir(path.dirname(opts.backupDir), { recursive: true });
      await opts.fs.cp(opts.dest, opts.backupDir, { recursive: true, force: true });
      backedUpTo = opts.backupDir;
      log(`[hooks] backed up existing hooks → ${opts.backupDir}`);
      await opts.fs.rm(opts.dest, { recursive: true, force: true });
    }

    await opts.fs.mkdir(opts.dest, { recursive: true });
    const copied: string[] = [];
    for (const name of files) {
      const from = path.join(opts.source, name);
      const to = path.join(opts.dest, name);
      if (name === HOOK_SETTINGS_FILE && opts.interpreter) {
        const text = await opts.fs.readFile(from, "utf8");
        await opts.fs.writeFile(to, retargetHookSettings(text, opts.interpreter), "utf8");
      } else {
        await opts.fs.copyFile(from, to);
      }
      copied.push(name);
    }
    // Marker last: it is the "installed and complete" claim, and every later
    // activation trusts it over looking at the directory.
    await opts.fs.writeFile(path.join(opts.dest, HOOK_MARKER_FILE), version, "utf8");
    return { status: "ok", reason: "installed", copied, backedUpTo };
  } catch (e) {
    return { status: "failed", reason: errText(e), copied: [], backedUpTo };
  }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
