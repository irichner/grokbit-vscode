import { describe, it, expect } from "vitest";
import { filterDotEnv } from "../src/env-filter";

// Security finding: buildEnv (sidebar.ts) merges a workspace .env OVER
// process.env with no allowlist — a committed .env is attacker-controlled the
// moment a victim trusts the folder. filterDotEnv is the pure policy that
// keeps that layer from setting anything that redirects/reconfigures the
// spawned agent process (grok AND Claude both go through buildEnv).
describe("filterDotEnv", () => {
  it("passes ordinary vars through untouched", () => {
    const { env, dropped } = filterDotEnv({ MY_APP_FLAG: "1", GREETING: "hi" });
    expect(env).toEqual({ MY_APP_FLAG: "1", GREETING: "hi" });
    expect(dropped).toEqual([]);
  });

  it("drops every ANTHROPIC_-prefixed key", () => {
    const { env, dropped } = filterDotEnv({
      ANTHROPIC_API_KEY: "sk-x",
      ANTHROPIC_BASE_URL: "https://attacker.example",
      ANTHROPIC_AUTH_TOKEN: "tok",
      KEEP_ME: "1",
    });
    expect(env).toEqual({ KEEP_ME: "1" });
    expect(dropped.sort()).toEqual(["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"]);
  });

  it("drops every CLAUDE_-prefixed key", () => {
    const { env, dropped } = filterDotEnv({ CLAUDE_CODE_OAUTH_TOKEN: "tok", CLAUDE_CODE_USE_BEDROCK: "1" });
    expect(env).toEqual({});
    expect(dropped.sort()).toEqual(["CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK"]);
  });

  it("drops proxy vars in both upper and lower case", () => {
    const { env, dropped } = filterDotEnv({
      HTTP_PROXY: "http://a",
      https_proxy: "http://b",
      ALL_PROXY: "http://c",
      no_proxy: "localhost",
    });
    expect(env).toEqual({});
    expect(dropped).toHaveLength(4);
  });

  it("drops NODE_OPTIONS and NODE_EXTRA_CA_CERTS", () => {
    const { env, dropped } = filterDotEnv({ NODE_OPTIONS: "--inspect", NODE_EXTRA_CA_CERTS: "/tmp/rogue.pem" });
    expect(env).toEqual({});
    expect(dropped.sort()).toEqual(["NODE_EXTRA_CA_CERTS", "NODE_OPTIONS"]);
  });

  it("drops PATH (would shadow the real one)", () => {
    const { env, dropped } = filterDotEnv({ PATH: "/tmp/evil-bin", path: "/tmp/evil-bin-lower" });
    expect(env).toEqual({});
    expect(dropped).toHaveLength(2);
  });

  it("drops a lowercase anthropic_/claude_ key too (case-insensitive prefix match)", () => {
    const { env, dropped } = filterDotEnv({ anthropic_api_key: "sk-x", claude_code_oauth_token: "t" });
    expect(env).toEqual({});
    expect(dropped).toEqual(["anthropic_api_key", "claude_code_oauth_token"]);
  });

  it("returns dropped names in the input's own key order", () => {
    const { dropped } = filterDotEnv({ KEEP: "1", ANTHROPIC_API_KEY: "x", PATH: "y" });
    expect(dropped).toEqual(["ANTHROPIC_API_KEY", "PATH"]);
  });

  it("only matches the prefix at the start of the key, not anywhere inside it", () => {
    const { env, dropped } = filterDotEnv({ MY_ANTHROPIC_REFERENCE: "not a real var" });
    expect(env).toEqual({ MY_ANTHROPIC_REFERENCE: "not a real var" });
    expect(dropped).toEqual([]);
  });

  it("handles an empty input", () => {
    expect(filterDotEnv({})).toEqual({ env: {}, dropped: [] });
  });

  // M2 product-review: workspace .env must not plant xAI/Grok API credentials
  // (mirrors XAI_SECRET_ENV_VARS + voice key; XAI_ is a prefix deny).
  it("drops XAI_-prefixed keys (case-insensitive)", () => {
    const { env, dropped } = filterDotEnv({
      XAI_API_KEY: "sk-attacker",
      xai_base_url: "https://evil.example",
      KEEP: "1",
    });
    expect(env).toEqual({ KEEP: "1" });
    expect(dropped.sort()).toEqual(["XAI_API_KEY", "xai_base_url"].sort());
  });

  it("drops Grok credential exact names", () => {
    const { env, dropped } = filterDotEnv({
      GROK_CODE_XAI_API_KEY: "a",
      GROK_VOICE_API_KEY: "b",
      GROK_API_KEY: "c",
      MY_FLAG: "ok",
    });
    expect(env).toEqual({ MY_FLAG: "ok" });
    expect(dropped.sort()).toEqual([
      "GROK_API_KEY",
      "GROK_CODE_XAI_API_KEY",
      "GROK_VOICE_API_KEY",
    ]);
  });

  it("still allows non-credential GROK_ flags from .env", () => {
    // Discovery opt-outs are not secrets; shell/user process.env still wins when
    // not in .env — only the workspace layer is filtered.
    const { env, dropped } = filterDotEnv({ GROK_CLAUDE_SKILLS_ENABLED: "false" });
    expect(env).toEqual({ GROK_CLAUDE_SKILLS_ENABLED: "false" });
    expect(dropped).toEqual([]);
  });
});
