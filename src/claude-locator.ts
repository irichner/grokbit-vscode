import { existsSync } from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Locate + provision the `@zed-industries/claude-code-acp` adapter and build the
 * spawn plumbing (argv + env) for it, mirroring how `cli-locator.ts` does the same
 * for grok. Unlike `locateGrokCli` (which reads `HOME`/`PATH` itself), the search
 * here is fully parameterized so the whole resolution order is unit-testable
 * against fixture directories with no environment mutation or process spawning —
 * see docs/plans/claude-code-backend.md § WP1 and research/claude-code-backend.md.
 */

const IS_WIN = process.platform === "win32";

const ADAPTER_PACKAGE = "@zed-industries/claude-code-acp";
const ADAPTER_SCOPED_DIR = path.join("@zed-industries", "claude-code-acp");
const ADAPTER_ENTRY_SUFFIX = path.join("dist", "index.js");

/**
 * The exact `@zed-industries/claude-code-acp` version this extension provisions
 * and pins to — the single source of truth, documented like
 * `GROK_STDIO_DOWNGRADE_TARGET` in `cli-locator.ts`.
 *
 * The adapter is pre-1.0 (`unstable_setSessionModel` is still an `unstable_*`
 * method) and is a measured **120MB unpacked** (61MB of vendored ripgrep across six
 * platform builds, 11MB `cli.js`, 19MB platform `sharp`) — see the plan's "Packaging
 * decision". It is never bundled in the vsix; the extension installs this exact
 * version on demand into an extension-managed directory
 * (`context.globalStorageUri`) so a wire-format change upstream can't silently
 * break Grokbit. Wire shapes verified against Claude Code 2.1.220 on 2026-07-27
 * (research/claude-code-backend.md). Bump deliberately, after re-verifying those
 * shapes.
 *
 * **Supply-chain trust decision — what this pin covers, precisely (documented,
 * not "fixed" — see below for why).** `installClaudeAdapter` runs
 * `npm i --prefix <dir> @zed-industries/claude-code-acp@<this version>`, which
 * pins ONLY this top-level version. `--prefix` installs into a fresh tree with
 * no lockfile (this is `npm install`, not `npm ci` against a checked-in
 * `package-lock.json`), so every TRANSITIVE dependency still resolves fresh
 * from its own semver range at install time — this constant pins the
 * adapter's OWN code, not the exact bytes of everything it depends on.
 * Lifecycle scripts (install/postinstall) run normally — deliberately NOT
 * `--ignore-scripts` — because the package vendors native artifacts (ripgrep,
 * sharp) that may need a postinstall step to be usable; disabling scripts
 * risks a silently broken install, which is worse than the (accepted)
 * supply-chain exposure. This is a considered trust decision — the adapter is
 * Zed-maintained on a version bump cadence we control, installed once per
 * machine into an extension-managed directory the user can inspect or
 * delete — not an oversight to "fix" by adding `--ignore-scripts`.
 */
export const CLAUDE_ACP_ADAPTER_VERSION = "0.16.2";

/**
 * Search roots for `locateClaudeAdapter`, gathered by an impure caller (later work
 * package — see `defaultClaudeAdapterSearchRoots` below for a thin default).
 */
export interface ClaudeAdapterSearchRoots {
  /**
   * Extension-managed per-user install dir (e.g. `context.globalStorageUri.fsPath`)
   * — where the onboarding "Install" action runs
   * `npm i --prefix <dir> @zed-industries/claude-code-acp@<pinned>`.
   */
  managedInstallRoot?: string;
  /**
   * Global npm `node_modules` roots to check for a user-installed copy of the
   * package (e.g. the trimmed output of `npm root -g`).
   */
  globalNpmRoots?: string[];
  /** Directories to search for a PATH-installed `claude-code-acp` entry. */
  pathDirs?: string[];
}

function adapterBinNames(): string[] {
  // A global npm install puts a shim on PATH: a `.cmd` (and usually a plain
  // extension-less shim alongside it) on Windows, a single extension-less
  // executable shim elsewhere.
  return IS_WIN ? ["claude-code-acp.cmd", "claude-code-acp.exe", "claude-code-acp"] : ["claude-code-acp"];
}

/**
 * Resolve the adapter's `dist/index.js` entrypoint. Pure — every search root is a
 * parameter, so this is testable with no `HOME`/`PATH` mutation and no process
 * spawning. Resolution order: configured path → extension-managed install →
 * globally installed npm package → PATH. A configured path that doesn't exist is a
 * hard miss (mirrors `locateGrokCli`) — it does not fall through to the other
 * roots, since a stale/typo'd setting should surface as broken, not silently
 * resolve to something else.
 */
export function locateClaudeAdapter(configuredPath: string | undefined, roots: ClaudeAdapterSearchRoots = {}): string | undefined {
  if (configuredPath) {
    return existsSync(configuredPath) ? configuredPath : undefined;
  }

  if (roots.managedInstallRoot) {
    const candidate = path.join(roots.managedInstallRoot, "node_modules", ADAPTER_SCOPED_DIR, ADAPTER_ENTRY_SUFFIX);
    if (existsSync(candidate)) return candidate;
  }

  for (const root of roots.globalNpmRoots ?? []) {
    const candidate = path.join(root, ADAPTER_SCOPED_DIR, ADAPTER_ENTRY_SUFFIX);
    if (existsSync(candidate)) return candidate;
  }

  for (const dir of roots.pathDirs ?? []) {
    for (const name of adapterBinNames()) {
      const candidate = path.join(dir, name);
      if (!existsSync(candidate)) continue;
      if (!IS_WIN) return candidate; // POSIX: works today (symlink resolves to the real JS entry).
      // Windows: `candidate` here is a .cmd/.exe/extension-less SHIM, not JS —
      // running it via `process.execPath <file>` (ELECTRON_RUN_AS_NODE=1, see
      // buildClaudeAdapterEnv) would try to parse the shim as JavaScript and
      // fail with a syntax error, which surfaces as a confusing ACP handshake
      // timeout instead of a clean "adapter not found". A global npm install
      // puts the shim directly in the npm prefix and the real package in
      // "<prefix>/node_modules/..." right alongside it — the exact layout the
      // "global npm root" tier above already resolves via `npm root -g` — so
      // resolve to the real entrypoint there instead of returning the
      // unspawnable shim. Falls through (never returns the shim) when no such
      // layout exists alongside it.
      const entry = path.join(dir, "node_modules", ADAPTER_SCOPED_DIR, ADAPTER_ENTRY_SUFFIX);
      if (existsSync(entry)) return entry;
    }
  }

  return undefined;
}

/**
 * Impure: gathers the "globally installed npm package" and "PATH" search roots
 * for `locateClaudeAdapter` (`npm root -g`, `process.env.PATH`). Thin glue kept
 * separate from the pure resolution logic above, exactly as `cli-locator.ts`
 * separates `locateGrokCli` from its pure predicates. Not wired into the extension
 * yet (later work package) and not unit-tested directly — it spawns `npm`.
 */
export function defaultClaudeAdapterSearchRoots(env: NodeJS.ProcessEnv = process.env): { globalNpmRoots: string[]; pathDirs: string[] } {
  const pathValue = env.PATH ?? env.Path ?? "";
  const pathDirs = pathValue.split(path.delimiter).filter(Boolean);
  return { globalNpmRoots: globalNpmRoots(), pathDirs };
}

/**
 * Options for spawning a command that MIGHT resolve to a Windows `.cmd`/`.bat`
 * shim via `execFile`/`execFileSync` — used for both `npm` (below) and `claude`
 * (`checkClaudeAuthStatus`). Node 18+ refuses to spawn a `.cmd`/`.bat` directly
 * on Windows without `shell: true` (CVE-2024-27980) — a global npm install puts
 * exactly that shim on PATH for both commands, so `execFile("npm", …)` /
 * `execFile("claude", …)` throw ENOENT (no extension resolution) and
 * `execFile("npm.cmd", …)` / `execFile("claude.cmd", …)` throw EINVAL (the CVE
 * mitigation blocks it outright).
 *
 * Unconditional here, NOT suffix-gated like `acp.ts`'s `needsShell` — that
 * idiom only works when the command string already carries a known extension
 * (a resolved absolute path). Both callers here usually pass a bare command
 * name (`"npm"`, or `claudeBin`'s default `"claude"`) with no extension AT
 * ALL to gate on, so a suffix check would silently miss the exact PATH-shim
 * scenario this fixes. Shell mode works equally well for a real `.exe`/script
 * (the minor cost is one extra cmd.exe layer), so unconditional is both
 * simpler and strictly more correct than trying to guess from an unqualified
 * name. No shell on POSIX, where `execFile(cmd, …)` resolves and spawns
 * directly. Verified on this machine: bare `spawn("npm",…)` → ENOENT,
 * `spawn("npm.cmd",…)` → EINVAL, `spawn("npm",…,{shell:true})` → works.
 */
export function shellExecOptions<T extends object>(extra: T): T & { shell: boolean } {
  return { ...extra, shell: IS_WIN };
}

/**
 * Quote a single argv element for Windows cmd.exe. When `shell: true` is used
 * on Windows, Node just joins `[command, ...args]` with spaces before handing
 * the whole string to cmd.exe (see the Node `child_process` docs — shell mode
 * does not itself escape/quote args) — so any element containing a space or a
 * shell metacharacter (`&`, `^`, …) must be pre-quoted here, or cmd.exe
 * re-splits/re-interprets it. This applies to the COMMAND itself too, not just
 * its args — Node joins `[file, ...args]`, so a configured `claudeBin` full
 * path with spaces (`C:\Program Files\...\claude.exe`) needs the same
 * treatment as `installRoot` (from `globalStorageUri.fsPath`, which can
 * contain spaces and, in principle, `&`/`^`). Wrapping the whole value in
 * double quotes (escaping any embedded quote by doubling it) keeps cmd.exe
 * from re-parsing those characters. No-op on POSIX, where the command
 * resolves and spawns directly (no shell involved — see `shellExecOptions`).
 */
export function quoteForWindowsShell(arg: string): string {
  return IS_WIN ? `"${arg.replace(/"/g, '""')}"` : arg;
}

/**
 * `npm root -g`, resolved at most once per extension host. This spawns npm — a
 * few hundred ms — and it is on the session-start path, so without the cache
 * every Claude session start pays a synchronous stall for a value that cannot
 * change while VS Code is running. `null` = looked up and unavailable (npm not
 * on PATH), which is cached too so a missing npm isn't re-probed on every start.
 */
let cachedGlobalNpmRoot: string | null | undefined;

function globalNpmRoots(): string[] {
  if (cachedGlobalNpmRoot === undefined) {
    try {
      cachedGlobalNpmRoot = execFileSync("npm", ["root", "-g"], shellExecOptions({ encoding: "utf8" as const })).trim() || null;
    } catch {
      // npm not on PATH, or the lookup failed — fall through to a PATH-only search.
      cachedGlobalNpmRoot = null;
    }
  }
  return cachedGlobalNpmRoot ? [cachedGlobalNpmRoot] : [];
}

/** Test seam: drop the memoized `npm root -g` result. */
export function resetGlobalNpmRootCache(): void {
  cachedGlobalNpmRoot = undefined;
}

/**
 * Impure: actually installs the pinned adapter version into `installRoot` via
 * `npm i --prefix <installRoot> @zed-industries/claude-code-acp@<pinned>`. Backs
 * the onboarding "Install" action. Kept thin so the interesting decision (which
 * version, where) lives in the pure constant above; not unit-tested directly (it
 * spawns real `npm` and downloads from the registry) — the shell/quoting it
 * relies on IS unit-tested, via `shellExecOptions`/`quoteForWindowsShell` above.
 * See `CLAUDE_ACP_ADAPTER_VERSION`'s doc for exactly what this pin covers (and
 * doesn't) — the supply-chain trust decision behind this call.
 *
 * **Asynchronous by design.** This downloads ~120MB and takes tens of seconds to
 * minutes. A synchronous spawn here would block the extension host's event loop
 * for that entire time, freezing every extension in the window (and VS Code's own
 * extension-driven UI) — not merely "briefly unresponsive". `maxBuffer` is raised
 * because npm is chatty and the default 1MB can abort a large install mid-flight.
 */
export async function installClaudeAdapter(installRoot: string): Promise<void> {
  await execFileAsync(
    "npm",
    ["i", "--prefix", quoteForWindowsShell(installRoot), `${ADAPTER_PACKAGE}@${CLAUDE_ACP_ADAPTER_VERSION}`],
    shellExecOptions({ maxBuffer: 32 * 1024 * 1024, encoding: "utf8" as const }),
  );
}

/**
 * Pure: redact credential-bearing substrings from npm's captured output before
 * it's logged or shown to the user. npm's install output can carry registry
 * URLs, and with credentials configured in `.npmrc` (`_authToken=…`,
 * `_auth=…`, or a `https://user:pass@registry…` URL), that output can carry
 * the credential itself — names/URLs survive, the secret substring never
 * does. Used by `installClaudeAdapterOnDemand` (sidebar.ts) on an install
 * failure; not applied to the happy path (nothing is ever logged then).
 */
export function redactNpmOutput(text: string): string {
  return text
    .replace(/(_authToken=)\S+/gi, "$1[redacted]")
    .replace(/(_auth=)\S+/gi, "$1[redacted]")
    .replace(/:\/\/[^/\s@]+:[^/\s@]+@/g, "://[redacted]@");
}

/**
 * Pure: the last `maxChars` characters of `text` (the most likely place npm's
 * actual failure summary sits — its output is verbose, and the final lines
 * carry the "npm ERR!" summary), for a bounded VS Code notification. The full
 * (redacted) text still goes to the output channel via the caller — this is
 * only for the transient toast.
 */
export function truncateTail(text: string, maxChars = 500): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `…${trimmed.slice(-maxChars)}`;
}

/**
 * Pure argv construction for spawning the adapter. Unlike grok (a CLI with
 * subcommands/flags — see `buildGrokAgentArgs`), the adapter is a plain Node
 * script with no argv of its own: `claude-acp-spawn-probe.cjs` confirms the only
 * argv element the working spawn used is the entry path itself. The spawn
 * *command* is the host process (`process.execPath` under Electron, P1-verified)
 * run as plain Node — see `buildClaudeAdapterEnv`'s `ELECTRON_RUN_AS_NODE`.
 */
export function buildClaudeAdapterArgv(entryPath: string): string[] {
  return [entryPath];
}

export interface ClaudeAdapterEnvOptions {
  /** The env to derive from — normally `process.env`. */
  baseEnv: NodeJS.ProcessEnv;
  /**
   * `grok.claude.executablePath` — points `CLAUDE_CODE_EXECUTABLE` at a native
   * `claude` install instead of driving the Agent SDK's bundled copy (P7,
   * opt-in). Falsy ⇒ the var is left unset (bundled copy).
   */
  claudeExecutablePath?: string;
  /**
   * Strip an *inherited* `ANTHROPIC_API_KEY` from the spawn env. Defaults to
   * stripping (i.e. this flag defaults to `false`/unset). Per
   * docs/plans/claude-code-backend.md § Authentication: a user signed in on a
   * Claude Max/Pro subscription may still happen to have `ANTHROPIC_API_KEY`
   * exported for some other tool: left alone, Claude Code would prefer it and
   * silently bill API credits instead of the subscription. Set true to opt back
   * in for users who deliberately want API-key billing.
   */
  allowInheritedApiKey?: boolean;
}

/**
 * xAI-specific secrets that must never reach a Claude-backed process. The
 * `baseEnv` passed in (`buildEnv(cwd)` in sidebar.ts) is the workspace `.env`
 * merged over `process.env`, which for a grok session carries `XAI_API_KEY`
 * (and `buildEnv`'s own `GROK_CODE_XAI_API_KEY` mapping from it) so the grok
 * CLI can authenticate. Handed unfiltered to Claude Code, its hooks, and its
 * MCP servers, a user asking "what env vars do you have?" would leak the xAI
 * key into an Anthropic transcript — the cross-vendor mirror of why
 * `ANTHROPIC_API_KEY` is stripped above (there: billing safety; here: secret
 * leakage). Named + documented here (rather than inline deletes) so the list
 * is one visible, unit-testable place.
 */
export const XAI_SECRET_ENV_VARS = ["XAI_API_KEY", "GROK_CODE_XAI_API_KEY"] as const;

/**
 * Pure env builder for spawning the adapter. This function never itself *sets* an
 * `ANTHROPIC_API_KEY` under any input — the only way one reaches the child process
 * is inherited from `baseEnv` and left alone via `allowInheritedApiKey: true` — so
 * "never inject ANTHROPIC_API_KEY" (see the plan's "must not do" list) is a
 * structural property of this function, not a runtime check.
 */
export function buildClaudeAdapterEnv(opts: ClaudeAdapterEnvOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...opts.baseEnv };

  // Claude Code refuses to launch inside another Claude Code session ("Nested
  // sessions share runtime resources and will crash all active sessions") —
  // strip the vars it uses to detect that, so Grokbit still works for anyone who
  // launched VS Code from inside a Claude Code terminal. See
  // research/claude-code-backend.md.
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDE_CODE_SSE_PORT;

  // Run the adapter under the Electron host as plain Node (P1-verified) — no
  // system Node required to *run* it.
  env.ELECTRON_RUN_AS_NODE = "1";

  if (opts.claudeExecutablePath) {
    env.CLAUDE_CODE_EXECUTABLE = opts.claudeExecutablePath;
  } else {
    delete env.CLAUDE_CODE_EXECUTABLE;
  }

  if (!opts.allowInheritedApiKey) {
    delete env.ANTHROPIC_API_KEY;
  }

  // ANTHROPIC_AUTH_TOKEN / CLAUDE_CODE_OAUTH_TOKEN are a legitimate credential
  // for the standard enterprise-gateway setup (LiteLLM / Bedrock-proxy style)
  // WHEN paired with ANTHROPIC_BASE_URL — stripping the token while leaving
  // the base URL would silently point requests at the gateway unauthenticated
  // (an opaque 401), so only strip them when ANTHROPIC_BASE_URL is unset: in
  // that case requests would otherwise go to Anthropic's own endpoint, where
  // subscription OAuth is the intended credential, and a leftover inherited
  // token is more likely stale/unrelated than deliberate. Routing flags
  // (CLAUDE_CODE_USE_BEDROCK/_VERTEX) are left alone either way — see
  // detectClaudeCredentialOverrides below for surfacing (not modifying) them.
  if (!env.ANTHROPIC_BASE_URL) {
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.CLAUDE_CODE_OAUTH_TOKEN;
  }

  // Never forward xAI's own secrets into a Claude-backed process — see
  // XAI_SECRET_ENV_VARS.
  for (const key of XAI_SECRET_ENV_VARS) delete env[key];

  return env;
}

/**
 * Env var NAMES (never values) whose PRESENCE means some credential/routing
 * override other than the default subscription OAuth is in effect for a
 * Claude-backed spawn. Surfaced (names only) in the composer chip's tooltip —
 * disclosure over silence — so it's never silently unclear that the
 * subscription isn't what's actually being billed, or that traffic is being
 * routed somewhere other than Anthropic's own endpoint.
 */
export const CLAUDE_CREDENTIAL_OVERRIDE_VARS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
] as const;

/**
 * Pure: names of whichever {@link CLAUDE_CREDENTIAL_OVERRIDE_VARS} are present
 * in `env` — never the values. `env` should be the SAME env the session was
 * actually spawned with (the output of `buildClaudeAdapterEnv`, after
 * stripping), so this reports what's really in effect, not what merely
 * happened to be inherited before stripping.
 */
export function detectClaudeCredentialOverrides(env: NodeJS.ProcessEnv): string[] {
  return CLAUDE_CREDENTIAL_OVERRIDE_VARS.filter((name) => !!env[name]);
}

/**
 * Pure: mask an email for LOGGING (PII a user might paste unredacted into a
 * bug report) — keeps the first character of the local part plus the full
 * domain, e.g. `"chris@example.com"` -> `"c****@example.com"`. This only
 * affects what lands in the Output channel; the composer chip's tooltip (a UI
 * affordance, not a log) still shows the address in full.
 */
export function maskEmail(email: string | undefined): string | undefined {
  if (!email) return email;
  const at = email.indexOf("@");
  if (at <= 0) return "****"; // no (or empty) local part — mask entirely rather than guess
  return `${email[0]}****${email.slice(at)}`;
}

/**
 * Parsed `claude auth status --json` output. Cleaner than grok's inferred
 * signed-in state — feeds the launcher's signed-out card and can show the active
 * account + plan. See research/claude-code-backend.md § Authentication.
 */
export interface ClaudeAuthStatus {
  loggedIn: boolean;
  authMethod?: string;
  apiProvider?: string;
  email?: string;
  orgName?: string;
  subscriptionType?: string;
}

const UNKNOWN_AUTH_STATUS: ClaudeAuthStatus = { loggedIn: false };

/**
 * Pure parser for `claude auth status --json`. Tolerant of missing fields and of
 * non-JSON/garbage output — a signed-out user, an old CLI without `--json`
 * support, or a corrupted pipe should all resolve to a clearly "unknown" (not
 * logged in) result rather than throwing.
 */
export function parseClaudeAuthStatus(output: string): ClaudeAuthStatus {
  if (!output || !output.trim()) return { ...UNKNOWN_AUTH_STATUS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return { ...UNKNOWN_AUTH_STATUS };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...UNKNOWN_AUTH_STATUS };

  const obj = parsed as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

  return {
    loggedIn: obj.loggedIn === true,
    authMethod: str(obj.authMethod),
    apiProvider: str(obj.apiProvider),
    email: str(obj.email),
    orgName: str(obj.orgName),
    subscriptionType: str(obj.subscriptionType),
  };
}

/**
 * Impure: runs `claude auth status --json` and parses the result via the pure
 * `parseClaudeAuthStatus`. `claudeBin` defaults to `"claude"` (PATH lookup); pass
 * a resolved `CLAUDE_CODE_EXECUTABLE` to check a specific install instead. Not
 * unit-tested directly (it spawns the real `claude` CLI) — see
 * `parseClaudeAuthStatus` for the tested logic.
 *
 * **Asynchronous by design.** This is called on every Claude session's
 * `startSession` success path purely to populate a tooltip
 * (`refreshClaudeAccount` in sidebar.ts) — spawning a Node CLI cold is
 * ~0.5–2s, and `execFileSync` used to freeze the WHOLE extension host for that
 * entire window on every Claude session start (the same objection this file
 * already raises against a synchronous adapter install). Callers should
 * `void`-fire this rather than await it on a UI-blocking path.
 *
 * **Same shell/quoting treatment as npm** (`shellExecOptions`/
 * `quoteForWindowsShell` — see the `shellExecOptions` doc for why this can't
 * be suffix-gated like `acp.ts`'s `needsShell`: the bare default `"claude"`
 * carries no extension to gate on, and that bare-PATH-lookup case is exactly
 * the scenario a global npm install of `claude` breaks on Windows).
 *
 * **`env` is required, not read from `process.env` implicitly** — pass the
 * SAME (already-stripped) env the session was actually spawned with
 * (`buildClaudeAdapterEnv`'s result). Checking with the raw extension-host env
 * instead would be inconsistent: e.g. it could report API-key auth from an
 * inherited `ANTHROPIC_API_KEY` even though the actual spawn had that key
 * stripped and used OAuth.
 */
export async function checkClaudeAuthStatus(claudeBin: string | undefined, env: NodeJS.ProcessEnv): Promise<ClaudeAuthStatus> {
  const bin = claudeBin || "claude";
  try {
    const { stdout } = await execFileAsync(
      quoteForWindowsShell(bin),
      ["auth", "status", "--json"],
      shellExecOptions({ encoding: "utf8" as const, env }),
    );
    return parseClaudeAuthStatus(stdout);
  } catch (e: unknown) {
    // `claude auth status` can exit non-zero while signed out but still print
    // JSON to stdout first; recover it from the error before giving up.
    const stdout = (e as { stdout?: unknown } | undefined)?.stdout;
    const out = typeof stdout === "string" ? stdout : stdout instanceof Buffer ? stdout.toString("utf8") : "";
    return out ? parseClaudeAuthStatus(out) : { ...UNKNOWN_AUTH_STATUS };
  }
}
