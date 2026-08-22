import { describe, it, expect } from "vitest";
import {
  PEER_DEFAULT_TIMEOUT_MS,
  PEER_MCP_SERVER_NAME,
  PEER_MCP_TOOL_NAME,
  PEER_RESULT_MAX_CHARS,
  buildPeerMcpServerConfig,
  clampPeerTimeoutMs,
  decidePeerReadiness,
  fitPeerResultText,
  mcpServersForSession,
  peerCardLabel,
  peerPromptEnvelope,
  peerTargetBackend,
  peerToolDescription,
  peerUserCommandConfirmMessage,
} from "../src/peer-agent";

describe("peerTargetBackend", () => {
  it("maps grok → claude and claude → grok", () => {
    expect(peerTargetBackend("grok")).toBe("claude");
    expect(peerTargetBackend("claude")).toBe("grok");
  });
});

describe("decidePeerReadiness", () => {
  const base = {
    parent: "grok" as const,
    enabled: true,
    otherBackendAvailable: true,
    liveSessionCount: 1,
    maxLiveSessions: 8,
  };

  it("allows a ready peer", () => {
    expect(decidePeerReadiness(base)).toEqual({ ok: true, target: "claude" });
  });

  it("rejects when disabled", () => {
    const r = decidePeerReadiness({ ...base, enabled: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/disabled/i);
  });

  it("rejects nested peer sessions (depth cap)", () => {
    const r = decidePeerReadiness({ ...base, isPeerSession: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/depth/i);
  });

  it("rejects when at live session cap", () => {
    const r = decidePeerReadiness({ ...base, liveSessionCount: 8, maxLiveSessions: 8 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/limit/i);
  });

  it("rejects when other backend unavailable", () => {
    const r = decidePeerReadiness({ ...base, otherBackendAvailable: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Claude|not available/i);
  });

  it("names Grok when parent is Claude and grok missing", () => {
    const r = decidePeerReadiness({
      ...base,
      parent: "claude",
      otherBackendAvailable: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Grok/i);
  });
});

describe("mcpServersForSession / buildPeerMcpServerConfig", () => {
  it("builds HTTP config with bearer token", () => {
    const c = buildPeerMcpServerConfig({
      url: "http://127.0.0.1:9/mcp",
      token: "secret",
    });
    expect(c.type).toBe("http");
    expect(c.name).toBe(PEER_MCP_SERVER_NAME);
    expect(c.url).toBe("http://127.0.0.1:9/mcp");
    expect(c.headers).toEqual([{ name: "Authorization", value: "Bearer secret" }]);
  });

  it("returns [] when injectPeer is false or url/token missing", () => {
    expect(mcpServersForSession({ injectPeer: false, url: "http://x", token: "t" })).toEqual([]);
    expect(mcpServersForSession({ injectPeer: true, token: "t" })).toEqual([]);
    expect(mcpServersForSession({ injectPeer: true, url: "http://x" })).toEqual([]);
  });

  it("returns one HTTP server when injecting", () => {
    const list = mcpServersForSession({
      injectPeer: true,
      url: "http://127.0.0.1:9/mcp",
      token: "t",
    });
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe(PEER_MCP_SERVER_NAME);
  });
});

describe("fitPeerResultText", () => {
  it("passes through short text", () => {
    expect(fitPeerResultText("hi")).toEqual({ text: "hi", truncated: false });
  });

  it("keeps the tail when over budget", () => {
    const s = "a".repeat(PEER_RESULT_MAX_CHARS + 10);
    const r = fitPeerResultText(s);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(PEER_RESULT_MAX_CHARS);
    expect(r.text.endsWith("a".repeat(20))).toBe(true);
  });
});

describe("envelopes and copy", () => {
  it("builds prompt envelope and tool description", () => {
    expect(peerPromptEnvelope("Grok Build")).toContain("Grok Build");
    expect(peerPromptEnvelope("Grok Build")).toContain("nested peer");
    expect(peerToolDescription("Claude Code")).toContain("Claude Code");
    expect(peerToolDescription("Claude Code")).toContain("prompt");
  });

  it("card label and confirm message name the target", () => {
    expect(peerCardLabel("claude")).toMatch(/Claude/);
    expect(peerUserCommandConfirmMessage("grok")).toMatch(/Grok/);
  });

  it("exports stable MCP tool name", () => {
    expect(PEER_MCP_TOOL_NAME).toBe("run_peer_agent");
  });
});

describe("clampPeerTimeoutMs", () => {
  it("defaults and clamps", () => {
    expect(clampPeerTimeoutMs(undefined)).toBe(PEER_DEFAULT_TIMEOUT_MS);
    expect(clampPeerTimeoutMs(NaN)).toBe(PEER_DEFAULT_TIMEOUT_MS);
    expect(clampPeerTimeoutMs(100)).toBe(5_000);
    expect(clampPeerTimeoutMs(99999999)).toBe(30 * 60 * 1000);
    expect(clampPeerTimeoutMs(60_000)).toBe(60_000);
  });
});
