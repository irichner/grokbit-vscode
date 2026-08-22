/**
 * Plan-mode enforcement policy (pure).
 *
 * grok's `x.ai/exit_plan_mode` treats *any* client response as approval, so we
 * cannot reject a plan at the protocol layer. Instead we enforce plan/act on
 * *our* side, at the two mandatory server→client choke points the agent cannot
 * avoid:
 *
 *   - `fs/write_text_file` — every file write
 *   - `terminal/create`    — every shell command
 *
 * Empirically (grok 0.2.3, ACP), a plan-mode turn only *reads* the workspace
 * (`fs/read_text_file` + internal search tools) and writes its plan to
 * `~/.grok/sessions/<cwd>/<id>/plan.md` — i.e. *outside* the workspace. So the
 * gate is not "block all writes"; it is "block writes that land inside the
 * workspace" (except grokbit-plan markdown under `.grokbit/plans/**` and
 * `docs/plans/**`), which protects the user's project while letting grok persist
 * its own plan file and grokbit-plan write its artifacts.
 *
 * These functions are pure so the policy can be unit-tested without spawning a
 * CLI; `acp.ts` / `sidebar.ts` call them with the live path/command strings.
 */

import * as nodePath from "node:path";

/** JSON-RPC error code we use when refusing a mutating call during plan mode. */
export const PLAN_BLOCKED_CODE = -32010;
export const PLAN_BLOCKED_WRITE_MSG =
  "Blocked by Plan first: approve the plan before writing files in the workspace.";
export const PLAN_BLOCKED_TERMINAL_MSG =
  "Blocked by Plan first: approve the plan before running commands that may change the workspace.";

/** Windows `\\?\` / `\\.\` (and `//?/` / `//./`) device prefixes. */
const WIN_DEVICE_PREFIX = /^[\\/]{2}[.?][\\/]/;

/**
 * Strip the Windows device prefix (`\\?\`, `\\.\`, `//?/`, `//./`), normalize
 * all separators to `/`, collapse `.`/`..` segments, and drop a trailing slash.
 * Drive-letter / backslash paths are treated as Windows and lower-cased for a
 * case-insensitive compare; POSIX paths stay case-sensitive.
 */
function canonical(p: string): { norm: string; windows: boolean } {
  let s = String(p || "").trim();
  const windows = WIN_DEVICE_PREFIX.test(s) || /^[a-zA-Z]:[\\/]/.test(s) || s.includes("\\");
  s = s.replace(WIN_DEVICE_PREFIX, ""); // \\?\C:\... or \\.\C:\... → C:\...
  s = s.replace(/\\/g, "/");
  s = nodePath.posix.normalize(s);
  s = s.replace(/\/+$/, ""); // drop trailing slash (but keep "/" root)
  if (s === "") s = "/";
  return { norm: windows ? s.toLowerCase() : s, windows };
}

function isAbsolutePath(p: string): boolean {
  const s = String(p || "").trim();
  return WIN_DEVICE_PREFIX.test(s) || /^[a-zA-Z]:[\\/]/.test(s) ||
    s.startsWith("/") || s.startsWith("\\");
}

function canonicalTarget(target: string, root: string): { norm: string; windows: boolean } {
  if (isAbsolutePath(target)) return canonical(target);
  const r = canonical(root);
  const t = canonical(target);
  const norm = nodePath.posix.normalize(`${r.norm}/${t.norm}`);
  return { norm: r.windows ? norm.toLowerCase() : norm, windows: r.windows };
}

/**
 * True if `target` resolves to `root` itself or somewhere beneath it. Used to
 * decide whether a write lands in the user's workspace (block) or outside it
 * (allow). Grok's own `~/.grok/.../plan.md` is handled separately because a
 * user may open their home directory as the workspace root.
 */
export function isInsideWorkspace(target: string, root: string): boolean {
  if (!target || !root) return false;
  const t = canonicalTarget(target, root).norm;
  const r = canonical(root).norm;
  if (r === "/" ) return t === "/" || t.startsWith("/");
  return t === r || t.startsWith(r + "/");
}

/** Tool-call `kind`s that mutate state and must be rejected while planning. */
const MUTATING_KINDS = new Set(["edit", "execute", "delete", "move", "write"]);

/** Read-only `kind`s the agent may use freely while planning. */
export function isMutatingKind(kind: string | undefined): boolean {
  return MUTATING_KINDS.has(String(kind || "").toLowerCase());
}

// Shell metacharacters that can chain, redirect, background, or smuggle code —
// any of these means we can't trust a head-token allowlist, so we block. Note a
// single `|` or `;` is NOT here: those split the command into stages (see
// isReadOnlyCommand), allowed only when every stage is itself read-only.
// `&&` is still blocked because `&` is in the class. Script-block braces `{ }`
// are blocked because an otherwise-safe cmdlet can host arbitrary code in one
// (e.g. `Select-Object @{e={ Remove-Item x }}`).
const UNSAFE_SHELL = /[>&`{}\r\n]|\$\(|\|\||<\(/;

const READONLY_HEADS = new Set([
  // POSIX
  "ls", "dir", "pwd", "cd", "echo", "cat", "type", "head", "tail", "less", "more",
  "grep", "rg", "ag", "ack", "find", "fd", "tree", "wc", "stat", "file", "which",
  "where", "whereis", "basename", "dirname", "realpath", "readlink", "du", "df",
  "printenv", "date", "whoami", "hostname", "uname", "sort", "uniq", "cut",
  // PowerShell read-only cmdlets + aliases. Inspection/formatting only — anything
  // that writes (out-file, set-content, tee-object, export-*) or executes
  // (foreach-object, where-object, invoke-expression/iex, invoke-command, start-process)
  // is deliberately excluded, so a pipeline containing one is blocked.
  "get-childitem", "gci", "get-content", "gc", "get-item", "gi",
  "get-itemproperty", "gp", "test-path", "resolve-path", "rvpa", "get-location", "gl",
  "select-object", "select", "format-table", "ft", "format-list", "fl", "format-wide", "fw",
  "sort-object", "measure-object", "measure", "select-string", "sls", "out-string",
  "get-command", "gcm", "get-help", "get-member", "gm", "compare-object",
  "write-output", "write-host",
]);

const GIT_READONLY = new Set([
  "status", "diff", "log", "show", "ls-files", "ls-tree",
  "rev-parse", "blame", "describe", "shortlog", "cat-file", "name-rev",
  "whatchanged",
]);

const PKG_READONLY = new Set(["ls", "list", "view", "info", "outdated", "why", "show", "audit"]);

const GIT_BRANCH_READONLY_FLAGS = new Set([
  "-a", "--all", "-r", "--remotes", "-v", "-vv", "--verbose", "--list",
  "--show-current", "--merged", "--no-merged", "--contains", "--no-contains",
  "--points-at", "--color", "--no-color", "--column", "--no-column",
]);
const GIT_BRANCH_READONLY_PREFIXES = ["--format=", "--sort=", "--color=", "--column="];

const GIT_TAG_READONLY_FLAGS = new Set([
  "-l", "--list", "-n", "--contains", "--no-contains", "--points-at",
  "--merged", "--no-merged", "--color", "--no-color", "--column", "--no-column",
]);
const GIT_TAG_READONLY_PREFIXES = ["-n", "--format=", "--sort=", "--color=", "--column="];

const GIT_WRITE_OUTPUT_OPTIONS = [
  "--output=", "--output-directory=",
];

function hasToken(tokens: string[], ...blocked: string[]): boolean {
  return tokens.some((t) => blocked.includes(t));
}

function hasTokenPrefix(tokens: string[], ...prefixes: string[]): boolean {
  return tokens.some((t) => prefixes.some((p) => t.startsWith(p)));
}

function hasGitWriteOption(tokens: string[]): boolean {
  return hasToken(tokens, "--output", "--output-directory", "--ext-diff") ||
    hasTokenPrefix(tokens, ...GIT_WRITE_OUTPUT_OPTIONS);
}

function allReadOnlyOptionTokens(tokens: string[], exact: Set<string>, prefixes: string[]): boolean {
  return tokens.every((t) => exact.has(t) || prefixes.some((p) => t.startsWith(p)));
}

function hasSedInPlace(tokens: string[]): boolean {
  return tokens.some((t) => /^-[a-z]*i([a-z]|\b)/i.test(t) || t.startsWith("--in-place"));
}

function hasOutputOption(tokens: string[]): boolean {
  return hasToken(tokens, "-o", "--output") || hasTokenPrefix(tokens, "--output=");
}

function isReadOnlyGit(tokens: string[]): boolean {
  const sub = (tokens[1] || "").toLowerCase();
  const args = tokens.slice(2).map((t) => t.toLowerCase());
  if (hasGitWriteOption(args)) return false;
  if (sub === "tag") return args.length === 0 ||
    allReadOnlyOptionTokens(args, GIT_TAG_READONLY_FLAGS, GIT_TAG_READONLY_PREFIXES);
  if (sub === "branch") return args.length === 0 ||
    allReadOnlyOptionTokens(args, GIT_BRANCH_READONLY_FLAGS, GIT_BRANCH_READONLY_PREFIXES);
  if (sub === "remote") {
    if (args.length === 0 || allReadOnlyOptionTokens(args, new Set(["-v", "--verbose"]), [])) return true;
    const action = args.find((a) => !a.startsWith("-"));
    return action === "show" || action === "get-url";
  }
  if (sub === "reflog") {
    if (args.length === 0) return true;
    const action = args.find((a) => !a.startsWith("-")) || "show";
    return action === "show";
  }
  if (sub === "config") {
    if (args.length === 0) return false;
    if (args.length === 1 && !args[0].startsWith("-")) return true;
    return hasToken(args, "-l", "--list") ||
      hasTokenPrefix(args, "--get", "--get-regexp", "--show-origin", "--show-scope");
  }
  return GIT_READONLY.has(sub);
}

function isReadOnlyPackageCommand(tokens: string[]): boolean {
  const sub = (tokens[1] || "").toLowerCase();
  const args = tokens.slice(2).map((t) => t.toLowerCase());
  if (!PKG_READONLY.has(sub)) return false;
  if (sub === "audit" && (hasToken(args, "fix") || hasTokenPrefix(args, "--fix"))) return false;
  return true;
}

/** One pipeline stage: read-only iff its head token is a known read-only program. */
function isReadOnlyStage(stage: string): boolean {
  const tokens = stage.trim().split(/\s+/);
  if (!tokens[0]) return false;
  const head = tokens[0].toLowerCase().replace(/\.(exe|cmd|bat)$/i, "");
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  if (head === "git") {
    return isReadOnlyGit(lowerTokens);
  }
  if (head === "npm" || head === "pnpm" || head === "yarn" || head === "bun") {
    return isReadOnlyPackageCommand(lowerTokens);
  }
  if (head === "node" || head === "python" || head === "python3" || head === "deno") {
    // Only allow trivially read-only invocations like `node --version`.
    return tokens.length >= 2 && /^(-v|--version|--help|-h)$/.test(tokens[1]);
  }
  if (head === "sed" && hasSedInPlace(lowerTokens.slice(1))) return false;
  if (head === "find" && hasToken(lowerTokens.slice(1), "-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls")) return false;
  if (head === "fd" && hasToken(lowerTokens.slice(1), "-x", "--exec", "--exec-batch")) return false;
  if ((head === "sort" || head === "tree") && hasOutputOption(lowerTokens.slice(1))) return false;
  return READONLY_HEADS.has(head);
}

/**
 * Conservative classifier: a command is "read-only" (safe to run while
 * planning) only if it has no chaining/redirection/script-block metacharacters
 * AND every `|`- or `;`-separated stage is itself a known read-only program
 * (with a read-only subcommand for git/npm/pnpm/yarn). A pipe/sequence is
 * allowed only when every stage is read-only, so `Get-ChildItem | Select-Object`
 * and `Write-Output x; Test-Path` pass but `Get-ChildItem | Out-File x`,
 * `Test-Path a; Remove-Item b`, or `cat x | iex` do not. Quoted `;` inside a
 * single stage is fail-closed (the split is naive). Everything else is blocked.
 */
export function isReadOnlyCommand(command: string): boolean {
  const cmd = String(command || "").trim();
  if (!cmd) return false;
  if (UNSAFE_SHELL.test(cmd)) return false; // `||` and all non-stage metachars
  const stages = cmd.split(/[|;]/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (stages.length === 0) return false;
  return stages.every(isReadOnlyStage);
}

export interface PlanGateContext {
  active: boolean;
  workspaceRoot: string;
  grokHome?: string;
}

/** Should `fs/write_text_file` to `path` be refused right now? */
export function shouldBlockWrite(path: string, ctx: PlanGateContext): boolean {
  if (!ctx.active) return false;
  const isOwnPlanFile = isPlanFileWrite(path) &&
    (!ctx.grokHome || isInsideWorkspace(path, ctx.grokHome));
  if (isOwnPlanFile) return false;
  if (isWorkspacePlanArtifactWrite(path, ctx.workspaceRoot)) return false;
  return isInsideWorkspace(path, ctx.workspaceRoot);
}

/** Should `terminal/create` of `command` be refused right now? */
export function shouldBlockTerminal(command: string, ctx: PlanGateContext): boolean {
  return ctx.active && !isReadOnlyCommand(command);
}

/** Should a `session/request_permission` for `toolKind` be auto-rejected? */
export function shouldRejectPermission(toolKind: string | undefined, ctx: PlanGateContext): boolean {
  return ctx.active && isMutatingKind(toolKind);
}

export interface PermissionOptionLike {
  optionId: string;
  kind: string;
  name?: string;
}

/**
 * Pick the option that means "no" from a permission request's options. Prefers
 * an explicit `reject_once`, then any reject/deny kind; returns undefined if the
 * request offers no way to decline (caller should then fall back to the user).
 */
export function pickRejectOption(options: PermissionOptionLike[]): string | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  const exact = options.find((o) => o.kind === "reject_once");
  if (exact) return exact.optionId;
  const anyReject = options.find((o) => /reject|deny|cancel|no/i.test(o.kind));
  return anyReject?.optionId;
}

/**
 * True if `path` is grok's own plan file (`.grok/sessions/.../plan.md`). We
 * snoop the content of that write to populate the plan-review card, since
 * `exit_plan_mode` itself arrives with `planContent: null`.
 */
export function isPlanFileWrite(path: string): boolean {
  return /[\\/]\.grok[\\/]sessions[\\/].*[\\/]plan\.md$/i.test(String(path || ""));
}

const WORKSPACE_PLAN_ARTIFACT_DIRS = [".grokbit/plans/", "docs/plans/"];

/**
 * Workspace-relative path of `target` after canonicalize, or undefined when it
 * does not resolve inside `root`. Empty string means the root itself.
 */
function workspaceRelativeNorm(target: string, root: string): string | undefined {
  if (!isInsideWorkspace(target, root)) return undefined;
  const t = canonicalTarget(target, root).norm;
  const r = canonical(root).norm;
  if (t === r) return "";
  if (r === "/") return t.startsWith("/") ? t.slice(1) : t;
  if (t.startsWith(r + "/")) return t.slice(r.length + 1);
  return undefined;
}

/**
 * True if `path` canonicalizes inside `workspaceRoot` as markdown under
 * `.grokbit/plans/**` or `docs/plans/**`. `shouldBlockWrite` carve-out only —
 * do not use this to snoop into the plan-review card (see `isPlanFileWrite`).
 * `..` is collapsed by `canonical` before the prefix match, so an escape cannot
 * satisfy the glob.
 */
export function isWorkspacePlanArtifactWrite(path: string, workspaceRoot: string): boolean {
  const rel = workspaceRelativeNorm(path, workspaceRoot);
  if (!rel) return false;
  return WORKSPACE_PLAN_ARTIFACT_DIRS.some((dir) =>
    rel.startsWith(dir) && rel.endsWith(".md") && rel.length > dir.length);
}
