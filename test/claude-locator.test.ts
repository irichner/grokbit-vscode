import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  locateClaudeAdapter,
  buildClaudeAdapterArgv,
  buildClaudeAdapterEnv,
  parseClaudeAuthStatus,
  shellExecOptions,
  quoteForWindowsShell,
  redactNpmOutput,
  truncateTail,
  detectClaudeCredentialOverrides,
  maskEmail,
  XAI_SECRET_ENV_VARS,
  CLAUDE_CREDENTIAL_OVERRIDE_VARS,
  CLAUDE_ACP_ADAPTER_VERSION,
} from "../src/claude-locator";

const IS_WIN = process.platform === "win32";

function makeAdapterEntry(root: string): string {
  const dir = path.join(root, "node_modules", "@zed-industries", "claude-code-acp", "dist");
  fs.mkdirSync(dir, { recursive: true });
  const entry = path.join(dir, "index.js");
  fs.writeFileSync(entry, "// fake adapter entry\n");
  return entry;
}

describe("CLAUDE_ACP_ADAPTER_VERSION", () => {
  it("is pinned to the verified adapter version", () => {
    expect(CLAUDE_ACP_ADAPTER_VERSION).toBe("0.16.2");
  });
});

describe("locateClaudeAdapter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-locate-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns the configured path when it exists", () => {
    const configured = path.join(tmpDir, "custom-index.js");
    fs.writeFileSync(configured, "// custom\n");
    expect(locateClaudeAdapter(configured, { managedInstallRoot: tmpDir })).toBe(configured);
  });

  it("misses when the configured path does not exist, even if other roots would resolve", () => {
    const managedRoot = path.join(tmpDir, "managed");
    fs.mkdirSync(managedRoot, { recursive: true });
    makeAdapterEntry(managedRoot);
    const missingConfigured = path.join(tmpDir, "does-not-exist.js");
    expect(locateClaudeAdapter(missingConfigured, { managedInstallRoot: managedRoot })).toBeUndefined();
  });

  it("falls back to the extension-managed install dir when no configured path", () => {
    const managedRoot = path.join(tmpDir, "managed");
    fs.mkdirSync(managedRoot, { recursive: true });
    const entry = makeAdapterEntry(managedRoot);
    expect(locateClaudeAdapter(undefined, { managedInstallRoot: managedRoot })).toBe(entry);
  });

  it("falls back to a globally installed npm package when the managed dir has nothing", () => {
    const managedRoot = path.join(tmpDir, "managed-empty");
    fs.mkdirSync(managedRoot, { recursive: true });
    const globalRoot = path.join(tmpDir, "global-node-modules");
    const globalEntryDir = path.join(globalRoot, "@zed-industries", "claude-code-acp", "dist");
    fs.mkdirSync(globalEntryDir, { recursive: true });
    const globalEntry = path.join(globalEntryDir, "index.js");
    fs.writeFileSync(globalEntry, "// global\n");

    const result = locateClaudeAdapter(undefined, { managedInstallRoot: managedRoot, globalNpmRoots: [globalRoot] });
    expect(result).toBe(globalEntry);
  });

  it("falls back to PATH when nothing else resolves", () => {
    const binDir = path.join(tmpDir, "path-bin");
    fs.mkdirSync(binDir, { recursive: true });
    const binName = IS_WIN ? "claude-code-acp.cmd" : "claude-code-acp";
    const binPath = path.join(binDir, binName);
    fs.writeFileSync(binPath, IS_WIN ? "@echo mock\r\n" : "#!/bin/sh\necho mock\n");
    if (!IS_WIN) fs.chmodSync(binPath, 0o755);

    if (IS_WIN) {
      // Windows (#2): the PATH tier must resolve to the REAL JS entrypoint
      // alongside the shim (the layout a real global npm install produces —
      // shim in the prefix, package in "<prefix>/node_modules/..."), never
      // the shim itself. Running a .cmd through `process.execPath` as plain
      // Node (ELECTRON_RUN_AS_NODE) is a syntax error, not a working spawn —
      // it would surface as a confusing ACP handshake timeout instead of a
      // clean "adapter not found".
      const entry = makeAdapterEntry(binDir); // <binDir>/node_modules/@zed-industries/claude-code-acp/dist/index.js
      const result = locateClaudeAdapter(undefined, { pathDirs: [binDir] });
      expect(result).toBe(entry);
    } else {
      // POSIX: works today — the PATH entry is (in practice) a symlink to the
      // real JS file, so running it directly is fine.
      const result = locateClaudeAdapter(undefined, { pathDirs: [binDir] });
      expect(result).toBe(binPath);
    }
  });

  it("on Windows, a bare PATH shim with no adjacent package layout is never returned as the unspawnable shim itself (#2)", () => {
    if (!IS_WIN) return; // POSIX-only concern — see the branch above.
    const binDir = path.join(tmpDir, "path-bin-bare");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, "claude-code-acp.cmd"), "@echo mock\r\n");
    // No node_modules/@zed-industries/claude-code-acp/dist/index.js alongside
    // it — a non-standard layout (e.g. a hand-rolled shim). The PATH tier must
    // miss cleanly rather than hand back the .cmd file for `process.execPath`
    // to try to parse as JavaScript.
    expect(locateClaudeAdapter(undefined, { pathDirs: [binDir] })).toBeUndefined();
  });

  it("prefers the managed install over a global npm root, and a global npm root over PATH", () => {
    const managedRoot = path.join(tmpDir, "managed");
    const managedEntry = makeAdapterEntry(managedRoot);

    const globalRoot = path.join(tmpDir, "global-node-modules");
    const globalEntryDir = path.join(globalRoot, "@zed-industries", "claude-code-acp", "dist");
    fs.mkdirSync(globalEntryDir, { recursive: true });
    fs.writeFileSync(path.join(globalEntryDir, "index.js"), "// global\n");

    const binDir = path.join(tmpDir, "path-bin");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, IS_WIN ? "claude-code-acp.cmd" : "claude-code-acp"), "mock\n");

    const result = locateClaudeAdapter(undefined, {
      managedInstallRoot: managedRoot,
      globalNpmRoots: [globalRoot],
      pathDirs: [binDir],
    });
    expect(result).toBe(managedEntry);
  });

  it("returns undefined when nothing is found anywhere", () => {
    expect(locateClaudeAdapter(undefined, {})).toBeUndefined();
    expect(locateClaudeAdapter("", { managedInstallRoot: tmpDir, globalNpmRoots: [tmpDir], pathDirs: [tmpDir] })).toBeUndefined();
  });
});

// BLOCKER: bare `execFile("npm", …)` spawns fail on Windows — verified on a
// real machine: `spawn("npm",…)` → ENOENT, `spawn("npm.cmd",…)` → EINVAL
// (CVE-2024-27980), `spawn("npm",…,{shell:true})` → works. globalNpmRoots(),
// installClaudeAdapter(), and checkClaudeAuthStatus() all wire these two pure
// helpers in — checkClaudeAuthStatus hits the identical bug for `claude` (a
// global npm install of Claude Code puts claude.cmd on Windows PATH too).
describe("shellExecOptions", () => {
  it("includes shell:true on win32, and no shell elsewhere", () => {
    expect(shellExecOptions({}).shell).toBe(IS_WIN);
  });

  it("preserves the caller's own options alongside shell", () => {
    expect(shellExecOptions({ encoding: "utf8", maxBuffer: 123 })).toEqual({
      encoding: "utf8",
      maxBuffer: 123,
      shell: IS_WIN,
    });
  });
});

describe("quoteForWindowsShell", () => {
  it("wraps a path with a space in double quotes on win32; no-op elsewhere", () => {
    const withSpace = "C:\\Users\\John Doe\\AppData\\globalStorage";
    if (IS_WIN) {
      expect(quoteForWindowsShell(withSpace)).toBe(`"${withSpace}"`);
    } else {
      expect(quoteForWindowsShell(withSpace)).toBe(withSpace);
    }
  });

  it("escapes an embedded double quote by doubling it on win32", () => {
    if (!IS_WIN) return; // cmd.exe-specific quoting rule.
    expect(quoteForWindowsShell('C:\\has "quote"\\dir')).toBe('"C:\\has ""quote""\\dir"');
  });

  it("is a no-op for a plain value with no spaces on win32 too, aside from the quoting", () => {
    const plain = IS_WIN ? "C:\\plain\\path" : "/plain/path";
    expect(quoteForWindowsShell(plain)).toBe(IS_WIN ? `"${plain}"` : plain);
  });
});

// LOW finding: npm's captured install-failure output can carry a registry URL
// with embedded .npmrc credentials — redact before it's logged or shown.
describe("redactNpmOutput", () => {
  it("redacts an _authToken= value", () => {
    expect(redactNpmOutput("npm ERR! _authToken=abc123DEF\nmore text")).toBe(
      "npm ERR! _authToken=[redacted]\nmore text",
    );
  });

  it("redacts an _auth= value", () => {
    expect(redactNpmOutput("_auth=dGVzdDp0ZXN0")).toBe("_auth=[redacted]");
  });

  it("redacts a user:pass@ credential embedded in a URL", () => {
    expect(redactNpmOutput("fetching https://user:hunter2@registry.example.com/pkg")).toBe(
      "fetching https://[redacted]@registry.example.com/pkg",
    );
  });

  it("leaves ordinary output untouched", () => {
    const text = "npm ERR! 404 Not Found - GET https://registry.npmjs.org/@zed-industries%2fclaude-code-acp";
    expect(redactNpmOutput(text)).toBe(text);
  });
});

describe("truncateTail", () => {
  it("returns short text unchanged", () => {
    expect(truncateTail("short error")).toBe("short error");
  });

  it("keeps only the LAST maxChars characters, prefixed with an ellipsis", () => {
    const long = "a".repeat(50) + "TAIL_MARKER";
    const result = truncateTail(long, 20);
    expect(result.startsWith("…")).toBe(true);
    expect(result.endsWith("TAIL_MARKER")).toBe(true);
    expect(result.length).toBe(21); // ellipsis + 20 chars
  });

  it("trims surrounding whitespace before measuring", () => {
    expect(truncateTail("   padded   ")).toBe("padded");
  });
});

describe("buildClaudeAdapterArgv", () => {
  it("is just the entry path — the adapter is a plain script, not a CLI with flags", () => {
    expect(buildClaudeAdapterArgv("/x/dist/index.js")).toEqual(["/x/dist/index.js"]);
  });
});

describe("buildClaudeAdapterEnv", () => {
  it("strips CLAUDECODE / CLAUDE_CODE_ENTRYPOINT / CLAUDE_CODE_SSE_PORT", () => {
    const env = buildClaudeAdapterEnv({
      baseEnv: {
        CLAUDECODE: "1",
        CLAUDE_CODE_ENTRYPOINT: "cli",
        CLAUDE_CODE_SSE_PORT: "1234",
        UNRELATED: "keep-me",
      },
    });
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.CLAUDE_CODE_SSE_PORT).toBeUndefined();
    expect(env.UNRELATED).toBe("keep-me");
  });

  it("sets ELECTRON_RUN_AS_NODE=1", () => {
    const env = buildClaudeAdapterEnv({ baseEnv: {} });
    expect(env.ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("does not mutate the base env object passed in", () => {
    const baseEnv = { CLAUDECODE: "1" };
    buildClaudeAdapterEnv({ baseEnv });
    expect(baseEnv.CLAUDECODE).toBe("1");
  });

  it("sets CLAUDE_CODE_EXECUTABLE when the user configured their own Claude binary", () => {
    const env = buildClaudeAdapterEnv({ baseEnv: {}, claudeExecutablePath: "/usr/local/bin/claude" });
    expect(env.CLAUDE_CODE_EXECUTABLE).toBe("/usr/local/bin/claude");
  });

  it("leaves CLAUDE_CODE_EXECUTABLE unset when not configured, even if inherited", () => {
    const env = buildClaudeAdapterEnv({ baseEnv: { CLAUDE_CODE_EXECUTABLE: "/inherited/claude" } });
    expect(env.CLAUDE_CODE_EXECUTABLE).toBeUndefined();
  });

  it("strips an inherited ANTHROPIC_API_KEY by default", () => {
    const env = buildClaudeAdapterEnv({ baseEnv: { ANTHROPIC_API_KEY: "sk-inherited" } });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("keeps an inherited ANTHROPIC_API_KEY when the user opts back in", () => {
    const env = buildClaudeAdapterEnv({ baseEnv: { ANTHROPIC_API_KEY: "sk-inherited" }, allowInheritedApiKey: true });
    expect(env.ANTHROPIC_API_KEY).toBe("sk-inherited");
  });

  it("never injects an ANTHROPIC_API_KEY that wasn't already inherited", () => {
    const withoutFlag = buildClaudeAdapterEnv({ baseEnv: {} });
    const withFlag = buildClaudeAdapterEnv({ baseEnv: {}, allowInheritedApiKey: true });
    expect(withoutFlag.ANTHROPIC_API_KEY).toBeUndefined();
    expect(withFlag.ANTHROPIC_API_KEY).toBeUndefined();
  });

  // Security finding: buildEnv(cwd) in sidebar.ts (the caller's baseEnv) can carry
  // XAI_API_KEY (from a workspace .env) and its GROK_CODE_XAI_API_KEY mapping —
  // both would otherwise reach Claude Code, its hooks, and its MCP servers, leaking
  // the xAI key into an Anthropic transcript. No opt-back-in setting for these
  // (unlike ANTHROPIC_API_KEY) — this is a pure leak, not a billing-source choice.
  it("strips xAI-specific secrets (XAI_API_KEY, GROK_CODE_XAI_API_KEY) unconditionally", () => {
    const env = buildClaudeAdapterEnv({
      baseEnv: { XAI_API_KEY: "xai-secret", GROK_CODE_XAI_API_KEY: "xai-secret-mapped", UNRELATED: "keep-me" },
    });
    expect(env.XAI_API_KEY).toBeUndefined();
    expect(env.GROK_CODE_XAI_API_KEY).toBeUndefined();
    expect(env.UNRELATED).toBe("keep-me");
  });

  it("XAI_SECRET_ENV_VARS names exactly the two xAI-specific vars buildEnv() can produce", () => {
    expect(XAI_SECRET_ENV_VARS).toEqual(["XAI_API_KEY", "GROK_CODE_XAI_API_KEY"]);
  });

  // Adopted audit recommendation: ANTHROPIC_AUTH_TOKEN/CLAUDE_CODE_OAUTH_TOKEN
  // are a legitimate enterprise-gateway credential (LiteLLM/Bedrock-proxy)
  // WHEN paired with ANTHROPIC_BASE_URL — stripping the token there while
  // keeping the base URL would silently break that setup (an opaque 401).
  describe("conditional ANTHROPIC_AUTH_TOKEN / CLAUDE_CODE_OAUTH_TOKEN strip", () => {
    it("strips both when ANTHROPIC_BASE_URL is unset (requests would go to Anthropic's own endpoint)", () => {
      const env = buildClaudeAdapterEnv({
        baseEnv: { ANTHROPIC_AUTH_TOKEN: "tok", CLAUDE_CODE_OAUTH_TOKEN: "oauth-tok" },
      });
      expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
      expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    });

    it("keeps both when ANTHROPIC_BASE_URL is set (the enterprise-gateway setup)", () => {
      const env = buildClaudeAdapterEnv({
        baseEnv: {
          ANTHROPIC_BASE_URL: "https://litellm.example.com",
          ANTHROPIC_AUTH_TOKEN: "tok",
          CLAUDE_CODE_OAUTH_TOKEN: "oauth-tok",
        },
      });
      expect(env.ANTHROPIC_AUTH_TOKEN).toBe("tok");
      expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe("oauth-tok");
      expect(env.ANTHROPIC_BASE_URL).toBe("https://litellm.example.com");
    });

    it("never strips the routing flags (CLAUDE_CODE_USE_BEDROCK/_VERTEX) either way", () => {
      const withoutBaseUrl = buildClaudeAdapterEnv({ baseEnv: { CLAUDE_CODE_USE_BEDROCK: "1" } });
      const withBaseUrl = buildClaudeAdapterEnv({
        baseEnv: { ANTHROPIC_BASE_URL: "https://x", CLAUDE_CODE_USE_VERTEX: "1" },
      });
      expect(withoutBaseUrl.CLAUDE_CODE_USE_BEDROCK).toBe("1");
      expect(withBaseUrl.CLAUDE_CODE_USE_VERTEX).toBe("1");
    });
  });
});

describe("CLAUDE_CREDENTIAL_OVERRIDE_VARS / detectClaudeCredentialOverrides", () => {
  it("names exactly the six credential/routing override vars", () => {
    expect(CLAUDE_CREDENTIAL_OVERRIDE_VARS).toEqual([
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_VERTEX",
    ]);
  });

  it("returns an empty list for a clean env (no overrides — the default subscription OAuth case)", () => {
    expect(detectClaudeCredentialOverrides({ UNRELATED: "1" })).toEqual([]);
  });

  it("reports the NAMES of every present override, never their values", () => {
    const overrides = detectClaudeCredentialOverrides({
      ANTHROPIC_BASE_URL: "https://secret-gateway.example.com",
      ANTHROPIC_AUTH_TOKEN: "super-secret-token",
      UNRELATED: "1",
    });
    expect(overrides).toEqual(["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"]);
    // The whole point: the result never contains the actual secret/URL value.
    expect(overrides.join(",")).not.toContain("secret-gateway");
    expect(overrides.join(",")).not.toContain("super-secret-token");
  });

  it("ignores an empty-string value (unset in practice)", () => {
    expect(detectClaudeCredentialOverrides({ ANTHROPIC_API_KEY: "" })).toEqual([]);
  });
});

describe("maskEmail", () => {
  it("keeps the first character of the local part and the full domain", () => {
    expect(maskEmail("chris@example.com")).toBe("c****@example.com");
  });

  it("never leaks the rest of the local part", () => {
    expect(maskEmail("israel.richner@example.com")).not.toContain("israel");
  });

  it("passes through undefined", () => {
    expect(maskEmail(undefined)).toBeUndefined();
  });

  it("masks entirely for a malformed address with no local part", () => {
    expect(maskEmail("@example.com")).toBe("****");
  });

  it("handles a single-character local part", () => {
    expect(maskEmail("a@b.com")).toBe("a****@b.com");
  });
});

describe("parseClaudeAuthStatus", () => {
  it("parses a full logged-in payload", () => {
    const result = parseClaudeAuthStatus(
      JSON.stringify({
        loggedIn: true,
        authMethod: "oauth",
        apiProvider: "anthropic",
        email: "israel@example.com",
        orgName: "Acme Inc",
        subscriptionType: "max",
      })
    );
    expect(result).toEqual({
      loggedIn: true,
      authMethod: "oauth",
      apiProvider: "anthropic",
      email: "israel@example.com",
      orgName: "Acme Inc",
      subscriptionType: "max",
    });
  });

  it("parses a logged-out payload", () => {
    expect(parseClaudeAuthStatus(JSON.stringify({ loggedIn: false }))).toEqual({
      loggedIn: false,
      authMethod: undefined,
      apiProvider: undefined,
      email: undefined,
      orgName: undefined,
      subscriptionType: undefined,
    });
  });

  it("is tolerant of missing fields", () => {
    const result = parseClaudeAuthStatus(JSON.stringify({ loggedIn: true, email: "a@b.com" }));
    expect(result.loggedIn).toBe(true);
    expect(result.email).toBe("a@b.com");
    expect(result.authMethod).toBeUndefined();
    expect(result.subscriptionType).toBeUndefined();
  });

  it("ignores fields with the wrong type instead of throwing", () => {
    const result = parseClaudeAuthStatus(JSON.stringify({ loggedIn: true, email: 12345, orgName: null }));
    expect(result.loggedIn).toBe(true);
    expect(result.email).toBeUndefined();
    expect(result.orgName).toBeUndefined();
  });

  it("returns an unknown (not logged in) result for non-JSON garbage output", () => {
    expect(parseClaudeAuthStatus("command not found: claude").loggedIn).toBe(false);
    expect(parseClaudeAuthStatus("Error: ENOENT").loggedIn).toBe(false);
  });

  it("returns an unknown result for empty/blank output", () => {
    expect(parseClaudeAuthStatus("").loggedIn).toBe(false);
    expect(parseClaudeAuthStatus("   \n  ").loggedIn).toBe(false);
  });

  it("returns an unknown result for JSON that isn't a plain object", () => {
    expect(parseClaudeAuthStatus("null").loggedIn).toBe(false);
    expect(parseClaudeAuthStatus("42").loggedIn).toBe(false);
    expect(parseClaudeAuthStatus('"just a string"').loggedIn).toBe(false);
    expect(parseClaudeAuthStatus("[1,2,3]").loggedIn).toBe(false);
  });

  it("does not throw on malformed/truncated JSON", () => {
    expect(() => parseClaudeAuthStatus('{"loggedIn": true, "email":')).not.toThrow();
    expect(parseClaudeAuthStatus('{"loggedIn": true, "email":').loggedIn).toBe(false);
  });
});
