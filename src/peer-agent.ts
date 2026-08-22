/**
 * Pure policy for cross-CLI nested peer agents (HTTP MCP `run_peer_agent`).
 * No vscode / no spawn — unit-tested without either CLI.
 *
 * See docs/adr/0005-cross-cli-peer-agent-mcp.md and
 * research/peer-agent-mcp.md (HTTP only; stdio unsupported on current agents).
 */
import type { BackendId } from "./backends";
import { backendSpec } from "./backends";

/** Soft cap for text returned from a peer run into the parent tool result. */
export const PEER_RESULT_MAX_CHARS = 48_000;

/** Default wall-clock timeout for a peer `session/prompt` (ms). */
export const PEER_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/** MCP server name injected into parent sessions (tool ids: name__run_peer_agent). */
export const PEER_MCP_SERVER_NAME = "grokbit-peer";

/** Tool name exposed by the peer MCP server. */
export const PEER_MCP_TOOL_NAME = "run_peer_agent";

export type PeerReadiness =
  | { ok: true; target: BackendId }
  | { ok: false; reason: string };

export type PeerMcpHttpConfig = {
  type: "http";
  name: string;
  url: string;
  headers: { name: string; value: string }[];
};

/** Map the parent session backend to the peer (other) backend. */
export function peerTargetBackend(parent: BackendId): BackendId {
  return parent === "grok" ? "claude" : "grok";
}

/**
 * Whether a peer run may start. Pure: callers supply readiness booleans from
 * their own locate/auth probes — this module does not touch the filesystem.
 */
export function decidePeerReadiness(opts: {
  parent: BackendId;
  enabled: boolean;
  /** Parent already counting as a nested peer (should never expose MCP). */
  isPeerSession?: boolean;
  otherBackendAvailable: boolean;
  liveSessionCount: number;
  maxLiveSessions: number;
}): PeerReadiness {
  if (!opts.enabled) {
    return { ok: false, reason: "Peer agent is disabled (enable grok.peerAgent.enabled)." };
  }
  if (opts.isPeerSession) {
    return { ok: false, reason: "Peer nesting depth is capped at 1." };
  }
  if (opts.liveSessionCount >= opts.maxLiveSessions) {
    return {
      ok: false,
      reason: `Live session limit reached (${opts.maxLiveSessions}); close a tab before running a peer.`,
    };
  }
  if (!opts.otherBackendAvailable) {
    const target = peerTargetBackend(opts.parent);
    const label = backendSpec(target).label;
    return {
      ok: false,
      reason:
        target === "claude"
          ? `${label} is not available (adapter missing or not signed in).`
          : `${label} CLI is not available.`,
    };
  }
  return { ok: true, target: peerTargetBackend(opts.parent) };
}

/** Build the ACP mcpServers entry for a parent session (HTTP loopback). */
export function buildPeerMcpServerConfig(opts: {
  url: string;
  token: string;
}): PeerMcpHttpConfig {
  return {
    type: "http",
    name: PEER_MCP_SERVER_NAME,
    url: opts.url,
    headers: [{ name: "Authorization", value: `Bearer ${opts.token}` }],
  };
}

/**
 * mcpServers list for session/new|load. Empty when peer should not be injected
 * (disabled, peer-child session, or missing URL).
 */
export function mcpServersForSession(opts: {
  injectPeer: boolean;
  url?: string;
  token?: string;
}): PeerMcpHttpConfig[] {
  if (!opts.injectPeer || !opts.url || !opts.token) return [];
  return [buildPeerMcpServerConfig({ url: opts.url, token: opts.token })];
}

/** Truncate peer result text for the parent tool result. */
export function fitPeerResultText(
  text: string,
  maxChars = PEER_RESULT_MAX_CHARS,
): { text: string; truncated: boolean } {
  const t = text ?? "";
  if (t.length <= maxChars) return { text: t, truncated: false };
  return { text: t.slice(t.length - maxChars), truncated: true };
}

/** Envelope prepended to the peer's user prompt. */
export function peerPromptEnvelope(parentLabel: string): string {
  return (
    `[Grokbit peer agent]\n` +
    `You are running as a nested peer invoked from a ${parentLabel} session.\n` +
    `Complete the task below. Do not ask to switch backends. Reply with your final answer when done.\n\n`
  );
}

export function peerToolDescription(targetLabel: string): string {
  return (
    `Run a nested ${targetLabel} agent on the same workspace and wait for its result. ` +
    `Costs a second model turn. Prefer for tasks that benefit from the other agent; ` +
    `do not recurse. Args: { "prompt": string }.`
  );
}

/** Banner / card label for UI. */
export function peerCardLabel(target: BackendId): string {
  return `Peer: ${backendSpec(target).label}`;
}

export function peerUserCommandConfirmMessage(target: BackendId): string {
  const label = backendSpec(target).label;
  return (
    `Run a nested ${label} agent now? This starts a second session and may use ` +
    `additional quota. The current tab waits for the result.`
  );
}

/** Clamp timeout to a sane range. */
export function clampPeerTimeoutMs(ms: number | undefined): number {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return PEER_DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.floor(ms), 5_000), 30 * 60 * 1000);
}
