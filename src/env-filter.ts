// Pure filter for the workspace-`.env`-sourced layer of a spawned agent's
// environment. Kept out of sidebar.ts so the policy is unit-testable without
// vscode/fs. See `buildEnv` in sidebar.ts, the only caller.
//
// A workspace `.env` is attacker-controlled the moment a victim clones a repo
// and trusts the folder — `buildEnv` merges it OVER `process.env` with no
// allowlist, and the result flows into both the grok CLI and the Claude
// adapter. A committed `ANTHROPIC_BASE_URL`/`HTTP(S)_PROXY` redirects all
// model traffic (prompts, file contents, tool results) to a host the
// attacker controls — which also controls the *responses*, so it can drive
// edits and terminal commands the user reads as legitimate agent behaviour —
// and Claude Code sends its OAuth credential there too. `NODE_OPTIONS` /
// `NODE_EXTRA_CA_CERTS` can inject flags or a rogue CA into the child
// process; a `.env`-supplied `PATH` can shadow the real one entirely.
//
// This filters ONLY the `.env`-sourced layer, never the inherited real
// environment (`process.env`) — users legitimately set these for themselves
// in their own shell (an enterprise gateway, a corporate proxy, …), and that
// choice must survive. It also protects grok, not just Claude — `buildEnv` is
// shared by both backends, and that's intended: a malicious `.env` is exactly
// as dangerous redirecting grok's traffic.

/** Env var name PREFIXES that a workspace `.env` may never set — matched
 *  case-insensitively. Vendor-namespaced credential/config vars: letting a
 *  committed `.env` set ANY of these (not just the ones this extension itself
 *  reads) is never legitimate. */
const DENIED_DOT_ENV_PREFIXES = ["ANTHROPIC_", "CLAUDE_"];

/** Exact env var names a workspace `.env` may never set — matched
 *  case-insensitively (proxy vars are conventionally read in both
 *  `UPPER_CASE` and `lower_case` by different HTTP libraries, so both must be
 *  covered). Routing/interpreter/credential-store vars whose presence
 *  redirects or reconfigures the spawned process rather than merely
 *  parameterizing it. */
const DENIED_DOT_ENV_EXACT = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "NODE_OPTIONS",
  "NODE_EXTRA_CA_CERTS",
  "PATH",
];

function isDeniedDotEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  if (DENIED_DOT_ENV_EXACT.includes(upper)) return true;
  return DENIED_DOT_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

export interface DotEnvFilterResult {
  /** Every `dotEnv` entry EXCEPT the denied keys. */
  env: Record<string, string>;
  /** Names (never values) of the keys that were dropped, in `dotEnv`'s own
   *  key order — for a diagnosable, PII/secret-free log line. */
  dropped: string[];
}

/**
 * Filter a parsed workspace `.env` map down to the keys it's allowed to
 * merge into the spawned agent's environment. Pure — `dotEnv` is the already-
 * parsed key/value map (`readDotEnv`'s result in sidebar.ts), not a file path
 * or `process.env`, so this has no filesystem/environment dependency of its
 * own.
 */
export function filterDotEnv(dotEnv: Record<string, string>): DotEnvFilterResult {
  const env: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(dotEnv)) {
    if (isDeniedDotEnvKey(key)) {
      dropped.push(key);
      continue;
    }
    env[key] = value;
  }
  return { env, dropped };
}
